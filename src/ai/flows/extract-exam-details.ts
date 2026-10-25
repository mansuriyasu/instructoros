'use server';

import { generateWithAiFallback } from '@/ai/genkit';
import { parseExamOcr, recognizeDocumentText } from '@/ai/local-ocr';
import { ExamDetailsSchema, type ExamDetails } from './types';

export type ExtractExamDetailsResult =
  | { ok: true; details: ExamDetails }
  | { ok: false; error: string };

function getAiExtractionErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (/unsupported mime|unsupported.*file|image format|invalid image|media/i.test(message)) {
    return 'That file format is not supported. Please try a clear JPG, PNG, or PDF copy of the exam confirmation.';
  }
  if (/not found|404|no longer available|is not available|unknown model/i.test(message)) {
    return 'The configured AI model is unavailable. Please check the AI model settings in Hostinger.';
  }
  if (/api key|permission|unauthorized|forbidden|401|403/i.test(message)) {
    return 'The AI service is not authorized. Please check the AI credentials in Hostinger.';
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
  try {
    const local = await recognizeDocumentText(photoDataUri);
    if (local) {
      const details = parseExamOcr(local.text, local.confidence);
      if (details) {
        console.info('Exam details extracted with local OCR.');
        return details;
      }
    }
  } catch (error) {
    console.warn('Local exam OCR unavailable, using AI provider:', error instanceof Error ? error.message : error);
  }

  const llmResponse = await generateWithAiFallback({
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
