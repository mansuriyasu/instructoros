import Anthropic from '@anthropic-ai/sdk';
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages';
import { genkit, z, type GenerateOptions } from 'genkit';
import { toJsonSchema } from 'genkit/schema';
import { googleAI } from '@genkit-ai/google-genai';

// This is the correct way to initialize Genkit for use in the application.
// It creates a configured instance of Genkit with the specified plugins.
export const ai = genkit({
  plugins: [
    googleAI(),
  ],
});

// Gemini models to try, in order. GEMINI_MODEL lets the host pin a model
// without a code change. gemini-2.5-flash stays last as a fallback: Google only
// serves 2.5 models to API keys that already used them, so fresh keys get 404s.
const DEFAULT_GEMINI_MODELS = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-2.5-flash'];

export const GEMINI_MODELS = Array.from(
  new Set([process.env.GEMINI_MODEL?.trim(), ...DEFAULT_GEMINI_MODELS].filter(Boolean) as string[])
);

function isModelUnavailableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /not found|404|not supported for generatecontent|no longer available|is not available|deprecated|unknown model|model .* (does not exist|unavailable)/i.test(message);
}

function isDailyModelQuotaExhaustedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /generate content requests per day limit exceeded|GenerateRequestsPerDayPerProjectPerModel/i.test(message);
}

function isProviderFailoverError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    isModelUnavailableError(error) ||
    isDailyModelQuotaExhaustedError(error) ||
    /quota|rate limit|resource exhausted|429|api key|permission|unauthorized|forbidden|401|403|service unavailable|5\d\d|fetch failed|network/i.test(message)
  );
}

function mediaBlockFromDataUri(url: string): ContentBlockParam {
  const match = /^data:([^;,]+);base64,([\s\S]+)$/.exec(url);
  if (!match) {
    throw new Error('Claude fallback only accepts base64 data URI media.');
  }

  const [, mediaType, data] = match;
  if (mediaType === 'application/pdf') {
    return {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data },
    };
  }
  if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mediaType)) {
    throw new Error(`Claude fallback does not support media type ${mediaType}.`);
  }
  return {
    type: 'image',
    source: {
      type: 'base64',
      media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
      data,
    },
  };
}

function toClaudeContent(prompt: GenerateOptions['prompt']): ContentBlockParam[] {
  if (typeof prompt === 'string') {
    return [{ type: 'text', text: prompt }];
  }
  if (!Array.isArray(prompt)) {
    throw new Error('Claude fallback received an unsupported prompt format.');
  }

  return prompt.map((part) => {
    if ('text' in part && typeof part.text === 'string') {
      return { type: 'text', text: part.text };
    }
    if ('media' in part && part.media && typeof part.media.url === 'string') {
      return mediaBlockFromDataUri(part.media.url);
    }
    throw new Error('Claude fallback received an unsupported prompt part.');
  });
}

function toClaudeJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const normalize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(normalize);
    if (!value || typeof value !== 'object') return value;

    const result = Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, normalize(child)])
    ) as Record<string, unknown>;
    if (result.type === 'object') result.additionalProperties = false;
    return result;
  };

  return normalize(toJsonSchema({ schema }) ?? {}) as Record<string, unknown>;
}

async function generateWithClaude<O extends z.ZodTypeAny>(
  options: Omit<GenerateOptions<O>, 'model'>
): Promise<z.infer<O>> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  const schema = options.output?.schema;
  if (!apiKey || !schema) {
    throw new Error('Claude fallback is not configured.');
  }

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL?.trim() || 'claude-haiku-4-5',
    max_tokens: 2048,
    messages: [{ role: 'user', content: toClaudeContent(options.prompt) }],
    output_config: {
      format: {
        type: 'json_schema',
        schema: toClaudeJsonSchema(schema),
      },
    },
  });

  const text = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');
  if (!text) {
    throw new Error('Claude did not return structured output.');
  }
  return schema.parse(JSON.parse(text));
}

/**
 * Tries Gemini first, moving across model-specific daily quotas, then uses
 * Claude for provider outages, rate limits, or authorization failures.
 */
export async function generateWithAiFallback<O extends z.ZodTypeAny = z.ZodTypeAny>(
  options: Omit<GenerateOptions<O>, 'model'>
): Promise<{ output: z.infer<O> }> {
  let lastError: unknown;
  for (const modelName of GEMINI_MODELS) {
    try {
      const response = await ai.generate<O>({ ...options, model: `googleai/${modelName}` });
      return { output: response.output };
    } catch (error) {
      lastError = error;
      const canTryNextModel = isModelUnavailableError(error) || isDailyModelQuotaExhaustedError(error);
      if (!canTryNextModel) break;
      console.warn(`Gemini model ${modelName} unavailable or out of daily quota, trying next model:`, error instanceof Error ? error.message : error);
    }
  }

  if (lastError && isProviderFailoverError(lastError) && process.env.ANTHROPIC_API_KEY?.trim()) {
    console.warn('Gemini provider unavailable, using Claude fallback.');
    return { output: await generateWithClaude(options) };
  }
  throw lastError;
}
