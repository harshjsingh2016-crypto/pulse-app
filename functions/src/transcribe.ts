import { onCall, HttpsError } from 'firebase-functions/v2/https';
import OpenAI, { toFile } from 'openai';
import { getTranscribeModel } from './llm';
import { recordTranscription } from './usage';
import { enforceDailyLimit, resolveLimitDay } from './limits';

/**
 * Hard cap on one voice clip. Transcription is billed per minute, and the daily cap only
 * limits the NUMBER of clips, so the SIZE of a clip must be bounded too. 3 MB is ~3 min
 * of m4a at 128 kbps or ~12 min of webm/opus — well past any chat message.
 */
const MAX_AUDIO_BYTES = 3 * 1024 * 1024;
/** Longest duration the cost ledger will believe from the client (it is self-reported). */
const MAX_LEDGER_SECONDS = 10 * 60;

/**
 * Voice input: the client records a short audio clip and sends it base64-encoded;
 * this transcribes it via OpenAI (server-side key) and returns the text, which the
 * client drops into the chat input. Independent of the chat provider — always OpenAI.
 */
export const transcribeAudio = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Not signed in');
  if (!process.env['OPENAI_API_KEY']) {
    throw new HttpsError('failed-precondition', 'Voice input is not configured.');
  }

  const { audioBase64, mimeType, durationMs, clientDate } = request.data as {
    audioBase64?: unknown; mimeType?: unknown; durationMs?: unknown; clientDate?: unknown;
  };
  if (typeof audioBase64 !== 'string' || audioBase64.length === 0) {
    throw new HttpsError('invalid-argument', 'No audio provided');
  }
  // base64 is 4 chars per 3 bytes — check before decoding so an oversized payload never
  // allocates a buffer or reaches the transcription call.
  if (audioBase64.length * 0.75 > MAX_AUDIO_BYTES) {
    throw new HttpsError('invalid-argument', 'That recording is too long. Keep voice notes under a couple of minutes.');
  }

  // Enforce the per-user daily VOICE cap (separate counter from chat, same limit value)
  // before the transcription call — a blocked user costs nothing. Local day = user's
  // midnight reset, bounded to ±1 day of server UTC.
  await enforceDailyLimit(request.auth.uid, resolveLimitDay(clientDate), 'voice');

  const model = await getTranscribeModel(request.auth.uid);
  const buffer = Buffer.from(audioBase64, 'base64');

  // Pick a filename extension OpenAI recognizes from the recorded MIME type.
  const type = typeof mimeType === 'string' && mimeType.length <= 64 ? mimeType : 'audio/webm';
  const ext = type.includes('mp4') || type.includes('m4a') ? 'mp4'
    : type.includes('wav') ? 'wav'
      : type.includes('mpeg') || type.includes('mp3') ? 'mp3'
        : 'webm';
  const file = await toFile(buffer, `voice.${ext}`, { type });

  const client = new OpenAI({ apiKey: process.env['OPENAI_API_KEY'] });
  const result = await client.audio.transcriptions.create({ file, model });

  const seconds = typeof durationMs === 'number' && durationMs > 0
    ? Math.min(durationMs / 1000, MAX_LEDGER_SECONDS)
    : 0;
  await recordTranscription(request.auth.uid, model, seconds);

  return { text: (result as { text?: string }).text ?? '' };
});
