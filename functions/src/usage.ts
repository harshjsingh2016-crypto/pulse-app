import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const db = getFirestore();

/**
 * Per-model USD pricing per token.
 *  - input:          full-price uncached input
 *  - output:         completion tokens (for OpenAI reasoning models this includes reasoning tokens)
 *  - cachedInput:    per-token rate for cache-read / cached-input tokens
 *  - cacheWriteMult: multiplier on `input` for cache-*write* tokens (Anthropic charges 1.25×;
 *                    OpenAI has no separate write charge, so 0)
 *
 * OpenAI rates are 0 as placeholders — the user must supply input/output/cached prices for
 * gpt-5.1 and gpt-5-mini before GPT cost tracking is accurate. Token counts are still recorded.
 */
interface Price { input: number; output: number; cachedInput: number; cacheWriteMult: number }

const PRICING: Record<string, Price> = {
  'claude-sonnet-4-6': { input: 3 / 1e6, output: 15 / 1e6, cachedInput: 0.3 / 1e6, cacheWriteMult: 1.25 },
  'claude-haiku-4-5': { input: 1 / 1e6, output: 5 / 1e6, cachedInput: 0.1 / 1e6, cacheWriteMult: 1.25 },
  // OpenAI: cache reads bill at the "cached input" rate; no separate cache-write charge.
  'gpt-5.1': { input: 1.25 / 1e6, output: 10 / 1e6, cachedInput: 0.125 / 1e6, cacheWriteMult: 0 },
  'gpt-5-mini': { input: 0.25 / 1e6, output: 2 / 1e6, cachedInput: 0.025 / 1e6, cacheWriteMult: 0 },
};

/**
 * Per-minute USD pricing for speech-to-text (audio billing is per-minute, not per-token).
 * whisper-1 is the published rate; the gpt-4o estimates are OpenAI's per-minute figures —
 * confirm/correct if you want exact cost.
 */
const TRANSCRIBE_PRICING_PER_MIN: Record<string, number> = {
  'whisper-1': 0.006,
  'gpt-4o-mini-transcribe': 0.003,
  'gpt-4o-transcribe': 0.006,
};

/**
 * Records a voice-transcription call into the same daily ledger, under models.{model}
 * with `audio_seconds` + `cost_usd`. Cost is duration-based (per-minute). Never throws.
 */
export async function recordTranscription(userId: string, model: string, durationSec: number): Promise<void> {
  try {
    const cost = (durationSec / 60) * (TRANSCRIBE_PRICING_PER_MIN[model] ?? 0);
    const day = new Date().toISOString().split('T')[0]; // UTC
    await db.doc(`users/${userId}/usage/${day}`).set(
      {
        date: day,
        cost_usd: FieldValue.increment(cost),
        calls: FieldValue.increment(1),
        models: {
          [model]: {
            audio_seconds: FieldValue.increment(durationSec),
            cost_usd: FieldValue.increment(cost),
            calls: FieldValue.increment(1),
          },
        },
        updated_at: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  } catch (err) {
    console.error('[recordTranscription] failed (non-fatal):', err);
  }
}

/** The subset of a provider's usage we account for (already normalized by callLLM). */
export interface AnthropicUsage {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

/**
 * Best-effort per-user token + cost ledger at users/{uid}/usage/{YYYY-MM-DD} (UTC).
 * Stores daily totals AND a per-model breakdown under `models.{modelId}` so spend is
 * tracked separately across models and providers. Never throws — a bookkeeping failure
 * must not break the user's request.
 */
export async function recordUsage(userId: string, model: string, usage: AnthropicUsage): Promise<void> {
  try {
    const inTok = usage.input_tokens ?? 0;
    const outTok = usage.output_tokens ?? 0;
    const cacheWrite = usage.cache_creation_input_tokens ?? 0;
    const cacheRead = usage.cache_read_input_tokens ?? 0;

    const price = PRICING[model] ?? PRICING['claude-sonnet-4-6'];
    const cost =
      inTok * price.input +
      cacheWrite * price.input * price.cacheWriteMult +
      cacheRead * price.cachedInput +
      outTok * price.output;

    // Fresh increment sentinels per location (don't share sentinel instances across paths).
    // Model IDs contain dots (e.g. "gpt-5.1"); that's safe as a literal object key under
    // set({merge:true}) (only update() with dotted string paths would misread the dots).
    const increments = () => ({
      input_tokens: FieldValue.increment(inTok),
      output_tokens: FieldValue.increment(outTok),
      cache_creation_input_tokens: FieldValue.increment(cacheWrite),
      cache_read_input_tokens: FieldValue.increment(cacheRead),
      cost_usd: FieldValue.increment(cost),
      calls: FieldValue.increment(1),
    });

    const day = new Date().toISOString().split('T')[0]; // UTC calendar day
    await db.doc(`users/${userId}/usage/${day}`).set(
      {
        date: day,
        ...increments(),
        models: { [model]: increments() },
        updated_at: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  } catch (err) {
    console.error('[recordUsage] failed (non-fatal):', err);
  }
}
