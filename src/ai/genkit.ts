import { genkit, z, type GenerateOptions, type GenerateResponse } from 'genkit';
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

/**
 * Runs ai.generate against GEMINI_MODELS, moving to the next model only when
 * the current one is unavailable to this API key. Other errors are rethrown.
 */
export async function generateWithGemini<O extends z.ZodTypeAny = z.ZodTypeAny>(
  options: Omit<GenerateOptions<O>, 'model'>
): Promise<GenerateResponse<z.infer<O>>> {
  let lastError: unknown;
  for (const modelName of GEMINI_MODELS) {
    try {
      return await ai.generate<O>({ ...options, model: `googleai/${modelName}` });
    } catch (error) {
      lastError = error;
      if (!isModelUnavailableError(error)) throw error;
      console.warn(`Gemini model ${modelName} unavailable, trying next model:`, error instanceof Error ? error.message : error);
    }
  }
  throw lastError;
}
