'use server';

import { googleAI } from '@genkit-ai/google-genai';
import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const RouteOptimizationSchema = z.object({
  optimizedOrder: z.array(z.object({
    eventId: z.string().describe('The unique ID of the event.'),
    suggestedStartTime: z.string().describe('The new suggested start time in ISO format (e.g. 2026-06-22T10:00:00.000Z).'),
    suggestedEndTime: z.string().describe('The new suggested end time in ISO format.'),
    explanation: z.string().describe('A brief explanation of why this time/order was chosen (e.g. "Closer to previous student").')
  })).describe('The fully optimized ordered list of events.')
});

export type RouteOptimization = z.infer<typeof RouteOptimizationSchema>;

export type OptimizeRouteResult = 
  | { ok: true; details: RouteOptimization }
  | { ok: false; error: string };

export async function optimizeDailyRoute(
  events: Array<{ id: string; studentName: string; address: string; originalStart: string; originalEnd: string; durationMinutes: number }>,
  startAddress?: string
): Promise<RouteOptimization> {
  const llmResponse = await ai.generate({
    model: googleAI.model('gemini-2.5-flash'),
    output: { schema: RouteOptimizationSchema },
    prompt: `You are an expert mapping and logistics AI for a driving school.
Your goal is to optimize a daily schedule of driving lessons to minimize the driving travel time between student pickup locations.

Here are the lessons scheduled for today:
${JSON.stringify(events, null, 2)}

${startAddress ? `The instructor will start their day from: ${startAddress}` : 'Assume the instructor starts from the first scheduled student.'}

Instructions:
1. Re-order the lessons to form the shortest possible driving route.
2. Keep the original duration of each lesson intact.
3. Suggest realistic start and end times for the new order, leaving reasonable 15-30 minute gaps for driving between different addresses.
4. Try to keep the first lesson of the day roughly around the same time it was originally scheduled.
5. Return the newly ordered list with the calculated start and end times.
`,
  });

  const output = llmResponse.output;
  if (!output) {
    throw new Error('The AI model could not optimize the route.');
  }
  return output;
}

export async function optimizeDailyRouteSafe(
  events: Array<{ id: string; studentName: string; address: string; originalStart: string; originalEnd: string; durationMinutes: number }>,
  startAddress?: string
): Promise<OptimizeRouteResult> {
  try {
    const details = await optimizeDailyRoute(events, startAddress);
    return { ok: true, details };
  } catch (error) {
    console.error('AI route optimization failed:', error);
    return { ok: false, error: 'Could not optimize route.' };
  }
}
