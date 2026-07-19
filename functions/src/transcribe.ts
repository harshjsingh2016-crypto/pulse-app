import { onCall, HttpsError } from 'firebase-functions/v2/https';
import OpenAI, { toFile } from 'openai';
import { getTranscribeModel } from './llm';
import { recordTranscription } from './usage';

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

  const { audioBase64, mimeType, durationMs } = request.data as {
    audioBase64?: string; mimeType?: string; durationMs?: number;
  };
  if (!audioBase64) throw new HttpsError('invalid-argument', 'No audio provided');

  const model = await getTranscribeModel(request.auth.uid);
  const buffer = Buffer.from(audioBase64, 'base64');

  // Pick a filename extension OpenAI recognizes from the recorded MIME type.
  const type = mimeType || 'audio/webm';
  const ext = type.includes('mp4') || type.includes('m4a') ? 'mp4'
    : type.includes('wav') ? 'wav'
      : type.includes('mpeg') || type.includes('mp3') ? 'mp3'
        : 'webm';
  const file = await toFile(buffer, `voice.${ext}`, { type });

  const client = new OpenAI({ apiKey: process.env['OPENAI_API_KEY'] });
  const result = await client.audio.transcriptions.create({ file, model });

  await recordTranscription(request.auth.uid, model, (durationMs ?? 0) / 1000);

  return { text: (result as { text?: string }).text ?? '' };
});
