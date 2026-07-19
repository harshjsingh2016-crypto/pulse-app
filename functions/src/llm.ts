import { getFirestore } from 'firebase-admin/firestore';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

const db = getFirestore();

export type Provider = 'claude' | 'openai';

/**
 * The "large" slot serves the chat surfaces (main chat, task review, domain strategy);
 * the "small" slot serves cheap single-shot helpers (meal macros). Flipping the provider
 * flips both. OpenAI model IDs are the ones the user named — confirm they match the exact
 * strings the OpenAI API expects.
 */
export const MODELS: Record<Provider, { large: string; small: string }> = {
  claude: { large: 'claude-sonnet-4-6', small: 'claude-haiku-4-5' },
  openai: { large: 'gpt-5.1', small: 'gpt-5-mini' },
};

/** Reads the user's chosen chat provider; defaults to Claude. */
export async function getChatProvider(userId: string): Promise<Provider> {
  try {
    const snap = await db.doc(`users/${userId}`).get();
    return snap.data()?.['chat_provider'] === 'openai' ? 'openai' : 'claude';
  } catch {
    return 'claude';
  }
}

/** OpenAI speech-to-text models the user can pick for voice input. */
export const TRANSCRIBE_MODELS = ['gpt-4o-mini-transcribe', 'gpt-4o-transcribe', 'whisper-1'] as const;
export type TranscribeModel = (typeof TRANSCRIBE_MODELS)[number];

/** Reads the user's chosen voice-transcription model; defaults to gpt-4o-mini-transcribe. */
export async function getTranscribeModel(userId: string): Promise<TranscribeModel> {
  try {
    const snap = await db.doc(`users/${userId}`).get();
    const m = snap.data()?.['transcribe_model'];
    return TRANSCRIBE_MODELS.includes(m) ? (m as TranscribeModel) : 'gpt-4o-mini-transcribe';
  } catch {
    return 'gpt-4o-mini-transcribe';
  }
}

/** Normalized token accounting, provider-agnostic (see recordUsage for cost mapping). */
export interface NormalizedUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
}

export interface SystemBlock { text: string; cache?: boolean }
export interface LLMMessage { role: 'user' | 'assistant'; content: string }

export interface LLMResult { text: string; usage: NormalizedUsage }

/**
 * Single entry point for a chat/completion turn. Dispatches to the Anthropic or OpenAI
 * SDK and returns the assistant text plus normalized usage. The `cache` flag on a system
 * block only matters for Claude (Anthropic prompt caching); OpenAI caches automatically.
 */
export async function callLLM(opts: {
  provider: Provider;
  model: string;
  system?: SystemBlock[];
  messages: LLMMessage[];
  maxTokens: number;
  /** Stable per-user key that improves OpenAI cache-hit routing (ignored by Claude). */
  cacheKey?: string;
}): Promise<LLMResult> {
  return opts.provider === 'openai' ? callOpenAI(opts) : callClaude(opts);
}

async function callClaude(opts: {
  model: string; system?: SystemBlock[]; messages: LLMMessage[]; maxTokens: number;
}): Promise<LLMResult> {
  const client = new Anthropic({ apiKey: process.env['ANTHROPIC_API_KEY'] });
  const system = (opts.system ?? []).map((b) => ({
    type: 'text' as const,
    text: b.text,
    ...(b.cache ? { cache_control: { type: 'ephemeral' as const } } : {}),
  }));

  const response = await client.messages.create({
    model: opts.model,
    max_tokens: opts.maxTokens,
    ...(system.length ? { system } : {}),
    messages: opts.messages,
  });

  const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
  return {
    text,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
      cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? 0,
    },
  };
}

async function callOpenAI(opts: {
  model: string; system?: SystemBlock[]; messages: LLMMessage[]; maxTokens: number; cacheKey?: string;
}): Promise<LLMResult> {
  if (!process.env['OPENAI_API_KEY']) {
    throw new Error('OPENAI_API_KEY is not set — add it to functions/.env to use the ChatGPT provider.');
  }
  const client = new OpenAI({ apiKey: process.env['OPENAI_API_KEY'] });

  // OpenAI caches automatically by prefix (no cache_control). We already lead with the
  // static SYSTEM_PROMPT so the stable prefix caches; prompt_cache_key routes a given
  // user's requests to the same machine to raise the hit rate. Retention defaults to
  // 24h for non-ZDR orgs on gpt-5.1 — no explicit config needed.
  const systemText = (opts.system ?? []).map((b) => b.text).join('\n\n');
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    ...(systemText ? [{ role: 'system' as const, content: systemText }] : []),
    ...opts.messages,
  ];

  const response = await client.chat.completions.create({
    model: opts.model,
    // GPT-5 reasoning models: reasoning tokens count toward this budget, so give the
    // answer headroom above maxTokens. 'low' effort keeps chat snappy and cheap.
    max_completion_tokens: opts.maxTokens + 2048,
    reasoning_effort: 'low',
    ...(opts.cacheKey ? { prompt_cache_key: opts.cacheKey } : {}),
    messages,
  });

  const text = response.choices[0]?.message?.content ?? '';
  const u = response.usage;
  const cached = u?.prompt_tokens_details?.cached_tokens ?? 0;
  return {
    text,
    usage: {
      input_tokens: (u?.prompt_tokens ?? 0) - cached,
      output_tokens: u?.completion_tokens ?? 0,
      cache_read_input_tokens: cached,
      cache_creation_input_tokens: 0, // OpenAI has no separate cache-write charge
    },
  };
}
