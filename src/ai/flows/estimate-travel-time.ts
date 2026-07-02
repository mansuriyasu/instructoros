'use server';

import { googleAI } from '@genkit-ai/google-genai';
import { ai } from '@/ai/genkit';
import { TravelTimeEstimationSchema, type TravelTimeEstimation } from './types';

export type EstimateTravelTimeResult =
  | { ok: true; details: TravelTimeEstimation }
  | { ok: false; error: string };

export async function estimateTravelTime(
  origin: string,
  destination: string
): Promise<TravelTimeEstimation> {
  const llmResponse = await ai.generate({
    model: googleAI.model('gemini-2.5-flash'),
    output: { schema: TravelTimeEstimationSchema },
    prompt: `You are an expert mapping and logistics assistant. Estimate the typical driving time (in minutes) between the following two addresses:
Origin: ${origin}
Destination: ${destination}

Consider average traffic conditions. Return only the best single numeric estimate in minutes. If the locations are the same, return 0. If you cannot determine the locations, default to 30.`,
  });

  const output = llmResponse.output;
  if (!output) {
    throw new Error('The AI model could not calculate travel time.');
  }
  return output;
}

export async function estimateTravelTimeSafe(
  origin: string,
  destination: string
): Promise<EstimateTravelTimeResult> {
  try {
    const details = await estimateTravelTime(origin, destination);
    return { ok: true, details };
  } catch (error) {
    console.error('AI travel time estimation failed:', error);
    return { ok: false, error: 'Could not estimate travel time. Using default.' };
  }
}
