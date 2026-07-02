'use server';
/**
 * @fileOverview Extracts text from a driver's license image.
 *
 * - extractLicenseDetails - A function that extracts details from a license image.
 */

import { googleAI } from '@genkit-ai/google-genai';
import { ai } from '@/ai/genkit';
import { LicenseDetailsSchema, type LicenseDetails } from './types';

export type ExtractLicenseDetailsResult =
  | { ok: true; details: LicenseDetails }
  | { ok: false; error: string };

function getAiExtractionErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (/unsupported mime|unsupported.*file|image format|invalid image|media/i.test(message)) {
    return 'That file format is not supported. Please try a clear JPG, PNG, or PDF copy of the license.';
  }
  if (/api key|permission|unauthorized|forbidden|401|403/i.test(message)) {
    return 'The AI service is not authorized. Please check the Gemini API key in Hostinger.';
  }
  if (/quota|rate limit|resource exhausted|429/i.test(message)) {
    return 'The AI service is temporarily rate limited. Please try again shortly.';
  }
  if (/too large|payload|body|request entity|413/i.test(message)) {
    return 'That file is too large to scan. Please try a smaller photo or screenshot of the license.';
  }

  return 'Could not extract details from the license. Please try a clearer photo or enter the details manually.';
}

export async function extractLicenseDetails(
  photoDataUri: string
): Promise<LicenseDetails> {
  const llmResponse = await ai.generate({
    model: googleAI.model('gemini-2.5-flash'),
    output: { schema: LicenseDetailsSchema },
    prompt: [
      {
        text: `You are an expert at extracting information from driver's licenses and screenshots. 
               Extract the name, address, birthdate (in YYYYMMDD format), license number, and expiry date (in YYYYMMDD format) from the provided image.
               The image might be a driver's license, a text screenshot, or any other document containing student details. Extract whatever fields you can find and leave missing ones blank.
               Also, if there is a clear face photo of the person in the licence image, provide a tight bounding box around the actual face photo in [ymin, xmin, ymax, xmax] format scaled from 0 to 1000. Prefer the printed licence portrait, not the whole card or document.`,
      },
      { media: { url: photoDataUri } },
    ],
    config: {
      safetySettings: [
        {
          category: 'HARM_CATEGORY_HATE_SPEECH',
          threshold: 'BLOCK_NONE',
        },
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: 'BLOCK_NONE',
        },
        {
          category: 'HARM_CATEGORY_HARASSMENT',
          threshold: 'BLOCK_NONE',
        },
        {
          category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
          threshold: 'BLOCK_NONE',
        },
      ],
    },
  });

  const output = llmResponse.output;
  if (!output) {
    throw new Error('The AI model could not extract details from the image.');
  }
  return output;
}

export async function extractLicenseDetailsSafe(
  photoDataUri: string
): Promise<ExtractLicenseDetailsResult> {
  try {
    const details = await extractLicenseDetails(photoDataUri);
    return { ok: true, details };
  } catch (error) {
    console.error('AI license extraction failed:', error);
    return { ok: false, error: getAiExtractionErrorMessage(error) };
  }
}
