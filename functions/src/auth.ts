import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { createHash } from 'crypto';
import { Resend } from 'resend';

const db = getFirestore();

const OTP_TTL_MS = 10 * 60 * 1000;        // code valid for 10 minutes
const RESEND_COOLDOWN_MS = 60 * 1000;     // min 60s between sends to one email
const MAX_SENDS_PER_HOUR = 5;             // cap codes per email per hour (anti-bombing)
const MAX_ATTEMPTS = 5;                   // wrong-code attempts before invalidation

// Play Store / App Store review account. The reviewer can't receive a real OTP email,
// so this fixed email accepts a fixed code (no Resend, no rate limit). Enter these under
// Play Console → App access. Override via functions/.env if you want different values.
const REVIEW_EMAIL = (process.env['REVIEW_EMAIL'] ?? 'review@pulseaiapp.in').toLowerCase();
const REVIEW_CODE = process.env['REVIEW_OTP_CODE'] ?? '424242';

/** email_otps doc id — a hash of the email so we never store it as a raw doc key. */
const emailKey = (email: string) => createHash('sha256').update(email).digest('hex');
const hashCode = (email: string, code: string) =>
  createHash('sha256').update(`${email}:${code}`).digest('hex');

function normalizeEmail(raw: unknown): string {
  const email = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpsError('invalid-argument', 'Enter a valid email address.');
  }
  return email;
}

/** Send a 6-digit sign-in code to the given email (rate-limited). Callable pre-auth. */
export const requestEmailOtp = onCall(async (request) => {
  const email = normalizeEmail((request.data as { email?: unknown })?.email);

  // Review account: pretend success without sending or rate-limiting. The fixed code is
  // validated in verifyEmailOtp.
  if (email === REVIEW_EMAIL) return { success: true };

  const ref = db.doc(`email_otps/${emailKey(email)}`);
  const snap = await ref.get();
  const now = Date.now();

  // Rate limits: per-email cooldown + hourly cap (prevents spam / email bombing).
  const prev = snap.data() ?? {};
  const windowStart = (prev['window_start'] as Timestamp | undefined)?.toMillis() ?? 0;
  const inWindow = now - windowStart < 3600_000;
  const windowCount = inWindow ? ((prev['window_count'] as number) ?? 0) : 0;
  const sentAt = (prev['sent_at'] as Timestamp | undefined)?.toMillis() ?? 0;

  if (inWindow && windowCount >= MAX_SENDS_PER_HOUR) {
    throw new HttpsError('resource-exhausted', 'Too many codes requested. Try again later.');
  }
  if (now - sentAt < RESEND_COOLDOWN_MS) {
    throw new HttpsError('resource-exhausted', 'Please wait a moment before requesting another code.');
  }

  const apiKey = process.env['RESEND_API_KEY'];
  const from = process.env['RESEND_FROM'];
  if (!apiKey || !from) {
    throw new HttpsError('failed-precondition', 'Email sign-in is not configured.');
  }

  const code = String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
  await ref.set({
    email,
    code_hash: hashCode(email, code),
    expires_at: Timestamp.fromMillis(now + OTP_TTL_MS),
    attempts: 0,
    sent_at: Timestamp.fromMillis(now),
    window_start: Timestamp.fromMillis(inWindow ? windowStart : now),
    window_count: windowCount + 1,
  });

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: email,
    subject: `Your Pulse sign-in code: ${code}`,
    html:
      `<div style="font-family:system-ui,sans-serif;max-width:420px">
        <p>Your Pulse sign-in code is:</p>
        <p style="font-size:30px;font-weight:700;letter-spacing:6px;margin:12px 0">${code}</p>
        <p style="color:#666">This code expires in 10 minutes. If you didn't request it, you can ignore this email.</p>
      </div>`,
  });
  if (error) {
    console.error('[requestEmailOtp] resend error:', error);
    throw new HttpsError('internal', 'Could not send the code. Please try again.');
  }
  return { success: true };
});

/** Verify a code and return a Firebase custom token for signInWithCustomToken. */
export const verifyEmailOtp = onCall(async (request) => {
  const data = request.data as { email?: unknown; code?: unknown };
  const email = normalizeEmail(data?.email);
  const code = typeof data?.code === 'string' ? data.code.trim() : '';
  if (!/^\d{6}$/.test(code)) throw new HttpsError('invalid-argument', 'Enter the 6-digit code.');

  // Review account bypass — fixed email + code, no OTP doc required.
  if (email === REVIEW_EMAIL && code === REVIEW_CODE) {
    const auth = getAuth();
    let uid: string;
    try {
      uid = (await auth.getUserByEmail(email)).uid;
    } catch {
      uid = (await auth.createUser({ email, emailVerified: true })).uid;
    }
    return { token: await auth.createCustomToken(uid) };
  }

  const ref = db.doc(`email_otps/${emailKey(email)}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'No code found. Request a new one.');

  const otp = snap.data()!;
  if (Date.now() > (otp['expires_at'] as Timestamp).toMillis()) {
    await ref.delete();
    throw new HttpsError('deadline-exceeded', 'Code expired. Request a new one.');
  }
  if (((otp['attempts'] as number) ?? 0) >= MAX_ATTEMPTS) {
    await ref.delete();
    throw new HttpsError('resource-exhausted', 'Too many attempts. Request a new code.');
  }
  if (otp['code_hash'] !== hashCode(email, code)) {
    await ref.update({ attempts: FieldValue.increment(1) });
    throw new HttpsError('permission-denied', 'Incorrect code.');
  }
  await ref.delete();

  // Look up (or create) the Firebase user for this email, then mint a custom token.
  const auth = getAuth();
  let uid: string;
  try {
    uid = (await auth.getUserByEmail(email)).uid;
  } catch {
    uid = (await auth.createUser({ email, emailVerified: true })).uid;
  }
  const token = await auth.createCustomToken(uid);
  return { token };
});

/** Permanently delete the signed-in user's data and auth account (store requirement). */
export const deleteAccount = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Not signed in');
  const uid = request.auth.uid;
  // Removes the user doc and every subcollection (tasks, meals, usage, limits, chats…).
  await db.recursiveDelete(db.doc(`users/${uid}`));
  await getAuth().deleteUser(uid);
  return { success: true };
});
