import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { recordUsage } from './usage';
import { callLLM, getChatProvider, MODELS } from './llm';

const MACRO_PROMPT = `You are a nutritionist estimating macros for a meal described in natural language.
The user is Indian — assume Indian cooking methods and portion sizes unless stated otherwise.

Return ONLY valid JSON, no preamble, no explanation:
{
  "meal_type": "breakfast | lunch | dinner | snack",
  "cal": number,
  "protein_g": number,
  "carbs_g": number,
  "fat_g": number,
  "confidence": "high | medium | low",
  "note": "brief note if low confidence or ambiguous"
}

User input: "{DESCRIPTION}"`;

export const inferMacros = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Not signed in');

  const { description } = request.data as { description: string };
  if (!description?.trim()) throw new HttpsError('invalid-argument', 'Description is required');

  const provider = await getChatProvider(request.auth.uid);
  const model = MODELS[provider].small;

  const { text: completion, usage } = await callLLM({
    provider,
    model,
    maxTokens: 256,
    cacheKey: request.auth.uid,
    messages: [{ role: 'user', content: MACRO_PROMPT.replace('{DESCRIPTION}', description) }],
  });

  await recordUsage(request.auth.uid, model, usage);

  const raw = completion.trim();

  // Strip markdown code fences if present
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const text = fenceMatch ? fenceMatch[1].trim() : raw;

  try {
    return JSON.parse(text) as object;
  } catch {
    // Last resort: extract first {...} block
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]) as object;
      } catch {}
    }
    throw new HttpsError('internal', 'Failed to parse macro response');
  }
});
