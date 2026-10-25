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
const GROQ_REQUEST_TIMEOUT_MS = 12_000;
const GEMINI_REQUEST_TIMEOUT_MS = 7_000;
const CLAUDE_REQUEST_TIMEOUT_MS = 17_000;

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
    /quota|rate limit|resource exhausted|429|api key|permission|unauthorized|forbidden|401|403|service unavailable|5\d\d|fetch failed|network|abort|timeout|timed out/i.test(message)
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

function toOutputJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
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

type GroqContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

function toGroqContent(prompt: GenerateOptions['prompt']): GroqContentPart[] {
  if (typeof prompt === 'string') return [{ type: 'text', text: prompt }];
  if (!Array.isArray(prompt)) throw new Error('Groq received an unsupported prompt format.');

  return prompt.map((part) => {
    if ('text' in part && typeof part.text === 'string') {
      return { type: 'text', text: part.text };
    }
    if ('media' in part && part.media && typeof part.media.url === 'string') {
      if (!part.media.url.startsWith('data:image/')) {
        throw new Error('Groq vision only accepts image media.');
      }
      return { type: 'image_url', image_url: { url: part.media.url } };
    }
    throw new Error('Groq received an unsupported prompt part.');
  });
}

async function generateWithGroq<O extends z.ZodTypeAny>(
  options: Omit<GenerateOptions<O>, 'model'>
): Promise<z.infer<O>> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  const schema = options.output?.schema;
  if (!apiKey || !schema) throw new Error('Groq fallback is not configured.');

  const content = toGroqContent(options.prompt);
  const schemaJson = JSON.stringify(toOutputJsonSchema(schema));
  content.unshift({
    type: 'text',
    text: `Return only one valid JSON object matching this JSON Schema. Do not use markdown fences. Schema: ${schemaJson}`,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GROQ_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL?.trim() || 'qwen/qwen3.8-27b',
        messages: [{ role: 'user', content }],
        response_format: { type: 'json_object' },
        temperature: 0,
        max_completion_tokens: 2048,
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Groq ${response.status}: ${body.slice(0, 500)}`);
    }
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = payload.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('Groq did not return structured output.');
    return schema.parse(JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '')));
  } finally {
    clearTimeout(timeout);
  }
}

async function generateWithClaude<O extends z.ZodTypeAny>(
  options: Omit<GenerateOptions<O>, 'model'>
): Promise<z.infer<O>> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  const schema = options.output?.schema;
  if (!apiKey || !schema) {
    throw new Error('Claude fallback is not configured.');
  }

  const client = new Anthropic({
    apiKey,
    maxRetries: 0,
    timeout: CLAUDE_REQUEST_TIMEOUT_MS,
  });
  const response = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL?.trim() || 'claude-haiku-4-5',
    max_tokens: 2048,
    messages: [{ role: 'user', content: toClaudeContent(options.prompt) }],
    output_config: {
      format: {
        type: 'json_schema',
        schema: toOutputJsonSchema(schema),
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
 * Uses Groq's free vision/text tier first, then Gemini model quotas, and
 * finally Claude for provider outages, rate limits, or authorization failures.
 */
export async function generateWithAiFallback<O extends z.ZodTypeAny = z.ZodTypeAny>(
  options: Omit<GenerateOptions<O>, 'model'>
): Promise<{ output: z.infer<O> }> {
  let lastError: unknown;

  if (process.env.GROQ_API_KEY?.trim()) {
    try {
      return { output: await generateWithGroq(options) };
    } catch (error) {
      lastError = error;
      console.warn('Groq provider unavailable, using Gemini fallback:', error instanceof Error ? error.message : error);
    }
  }

  for (const modelName of GEMINI_MODELS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GEMINI_REQUEST_TIMEOUT_MS);
    try {
      const response = await ai.generate<O>({
        ...options,
        model: `googleai/${modelName}`,
        abortSignal: controller.signal,
      });
      return { output: response.output };
    } catch (error) {
      lastError = error;
      const canTryNextModel = isModelUnavailableError(error) || isDailyModelQuotaExhaustedError(error);
      if (!canTryNextModel) break;
      console.warn(`Gemini model ${modelName} unavailable, trying next model:`, error instanceof Error ? error.message : error);
    } finally {
      clearTimeout(timeout);
    }
  }

  if (lastError && isProviderFailoverError(lastError) && process.env.ANTHROPIC_API_KEY?.trim()) {
    console.warn('Gemini provider unavailable, using Claude fallback.');
    return { output: await generateWithClaude(options) };
  }
  throw lastError;
}
