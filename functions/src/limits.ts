import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

const db = getFirestore();

/**
 * Default daily cap applied when a user has no explicit `daily_message_limit` on their
 * user doc. Admin overrides this per user (see below). The SAME limit value applies to
 * every metered kind, but each kind is counted SEPARATELY (10 chat messages AND 10 voice
 * transcriptions AND 10 macro estimates per day, independently).
 *
 * HOW TO SET A USER'S LIMIT (low-effort, no deploy):
 *   Firebase Console → Firestore → `users` collection → open the user's doc (match by the
 *   `email` field) → add/edit a Number field named `daily_message_limit` (e.g. 50).
 *   Leave it unset (or delete it) to fall back to DEFAULT_DAILY_LIMIT.
 *   Set it to a large number (e.g. 100000) to effectively remove the cap for that user.
 *   Firestore rules block the CLIENT from writing this field, so only the console (or the
 *   admin SDK) can change it.
 */
export const DEFAULT_DAILY_LIMIT = 10;

/** Metered kinds. Every Cloud Function that calls a paid API must pass through one. */
export type LimitKind = 'chat' | 'voice' | 'macros';

const COUNT_FIELD: Record<LimitKind, string> = {
  chat: 'chat_count',
  voice: 'voice_count',
  macros: 'macros_count',
};

const LABEL: Record<LimitKind, string> = {
  chat: 'messages',
  voice: 'voice conversions',
  macros: 'macro estimates',
};

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

/**
 * The day a request counts against. The client sends its LOCAL calendar date so the cap
 * resets at the user's midnight — but a client-chosen key is a client-chosen counter, so
 * it is only honoured within one day of the server's UTC date (every timezone on Earth
 * falls inside that window). Anything else falls back to the server date. Worst case a
 * user who forges dates gets three live counters at once; long-run throughput is still
 * one limit per calendar day.
 */
export function resolveLimitDay(clientDate: unknown): string {
  const now = new Date();
  const serverDay = isoDate(now);
  if (typeof clientDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(clientDate)) return serverDay;
  const yesterday = isoDate(new Date(now.getTime() - 86400000));
  const tomorrow = isoDate(new Date(now.getTime() + 86400000));
  return clientDate === serverDay || clientDate === yesterday || clientDate === tomorrow
    ? clientDate
    : serverDay;
}

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
 * Each kind is tracked as its own field on `users/{uid}/limits/{day}`, so each gets an
 * independent allowance of `daily_message_limit` per day. `day` comes from
 * `resolveLimitDay`. Over-limit calls throw resource-exhausted and do NOT increment (or
 * cost anything, since this runs before the LLM/transcription call).
 */
export async function enforceDailyLimit(
  userId: string,
  day: string,
  kind: LimitKind,
): Promise<void> {
  const limit = await getDailyLimit(userId);
  const field = COUNT_FIELD[kind];
  const ref = db.doc(`users/${userId}/limits/${day}`);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const count = (snap.data()?.[field] as number | undefined) ?? 0;
    if (count >= limit) {
      throw new HttpsError(
        'resource-exhausted',
        `You've reached today's limit of ${limit} ${LABEL[kind]}. It resets at midnight.`,
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

/** Rejects anything that is not a non-empty string of at most `max` characters. */
export function requireText(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new HttpsError('invalid-argument', `${label} is required.`);
  }
  if (value.length > max) {
    throw new HttpsError('invalid-argument', `${label} is too long (max ${max} characters).`);
  }
  return value;
}

/** Firestore document ids as this app uses them: short, single-segment, no slashes. */
export function requireId(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 128 || value.includes('/')) {
    throw new HttpsError('invalid-argument', `Invalid ${label}.`);
  }
  return value;
}
