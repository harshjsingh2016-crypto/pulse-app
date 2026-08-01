import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

const db = getFirestore();

/**
 * Default daily cap applied when a user has no explicit `daily_message_limit` on their
 * user doc. Admin overrides this per user (see below). The SAME limit value applies to
 * chat AND voice, but they are counted SEPARATELY (10 chat messages AND 10 voice
 * transcriptions per day, independently).
 *
 * HOW TO SET A USER'S LIMIT (low-effort, no deploy):
 *   Firebase Console → Firestore → `users` collection → open the user's doc (match by the
 *   `email` field) → add/edit a Number field named `daily_message_limit` (e.g. 50).
 *   Leave it unset (or delete it) to fall back to DEFAULT_DAILY_LIMIT.
 *   Set it to a large number (e.g. 100000) to effectively remove the cap for that user.
 */
export const DEFAULT_DAILY_LIMIT = 10;

/** Reads a user's per-user daily limit; falls back to the default. Never throws. */
export async function getDailyLimit(userId: string): Promise<number> {
  try {
    const snap = await db.doc(`users/${userId}`).get();
    const v = snap.data()?.['daily_message_limit'];
    return typeof v === 'number' && v >= 0 ? v : DEFAULT_DAILY_LIMIT;
  } catch {
    return DEFAULT_DAILY_LIMIT;
  }
}

/**
 * Atomically enforce + increment a per-user daily cap for one usage `kind`.
 * `chat` and `voice` are tracked as separate fields on `users/{uid}/limits/{day}`, so
 * each gets its own independent allowance of `daily_message_limit` per day.
 * `day` is the user's LOCAL calendar day (YYYY-MM-DD) so limits reset at local midnight.
 * Over-limit calls throw resource-exhausted and do NOT increment (or cost anything, since
 * this runs before the LLM/transcription call).
 */
export async function enforceDailyLimit(
  userId: string,
  day: string,
  kind: 'chat' | 'voice',
): Promise<void> {
  const limit = await getDailyLimit(userId);
  const field = kind === 'voice' ? 'voice_count' : 'chat_count';
  const ref = db.doc(`users/${userId}/limits/${day}`);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const count = (snap.data()?.[field] as number | undefined) ?? 0;
    if (count >= limit) {
      const label = kind === 'voice' ? 'voice conversions' : 'messages';
      throw new HttpsError(
        'resource-exhausted',
        `You've reached today's limit of ${limit} ${label}. It resets at midnight.`,
      );
    }
    // expires_at lets a Firestore TTL policy on `limits` auto-delete stale daily counters.
    tx.set(
      ref,
      {
        [field]: count + 1,
        date: day,
        expires_at: Timestamp.fromMillis(Date.now() + 3 * 86400000),
      },
      { merge: true },
    );
  });
}
