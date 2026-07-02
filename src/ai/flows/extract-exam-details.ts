'use server';

import { googleAI } from '@genkit-ai/google-genai';
import { ai } from '@/ai/genkit';
import { ExamDetailsSchema, type ExamDetails } from './types';

export type ExtractExamDetailsResult =
  | { ok: true; details: ExamDetails }
  | { ok: false; error: string };

function getAiExtractionErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (/unsupported mime|unsupported.*file|image format|invalid image|media/i.test(message)) {
    return 'That file format is not supported. Please try a clear JPG, PNG, or PDF copy of the exam confirmation.';
  }
  if (/api key|permission|unauthorized|forbidden|401|403/i.test(message)) {
    return 'The AI service is not authorized. Please check the Gemini API key in Hostinger.';
  }
  if (/quota|rate limit|resource exhausted|429/i.test(message)) {
    return 'The AI service is temporarily rate limited. Please try again shortly.';
  }
  if (/too large|payload|body|request entity|413/i.test(message)) {
    return 'That file is too large to scan. Please try a smaller photo or screenshot of the confirmation.';
  }

  return 'Could not extract details from the exam confirmation. Please try a clearer photo or enter the details manually.';
}

export async function extractExamDetails(
  photoDataUri: string
): Promise<ExamDetails> {
  const llmResponse = await ai.generate({
    model: googleAI.model('gemini-2.5-flash'),
    output: { schema: ExamDetailsSchema },
    prompt: [
      {
        text: `You are an expert at extracting information from driving test booking confirmations (e.g. DriveTest Ontario). 
               Extract the student's name, the exam center name/location, the date of the exam (in YYYY-MM-DD), and the ACTUAL time of the road test exam. Pay close attention to the time: look for "Road Test Time", "Exam Time", or the main scheduled time. Do NOT use the "Check-in time" unless it is the only time available. YOU MUST format the time strictly in 24-hour HH:mm format (e.g., 14:30 for 2:30 PM, 09:15 for 9:15 AM). If a piece of information is missing, leave it as an empty string.`,
      },
      { media: { url: photoDataUri } },
    ],
  });

  const output = llmResponse.output;
  if (!output) {
    throw new Error('The AI model could not extract details from the image.');
  }
  return output;
}

export async function extractExamDetailsSafe(
  photoDataUri: string
): Promise<ExtractExamDetailsResult> {
  try {
    const details = await extractExamDetails(photoDataUri);
    return { ok: true, details };
  } catch (error) {
    console.error('AI exam extraction failed:', error);
    return { ok: false, error: getAiExtractionErrorMessage(error) };
  }
}
