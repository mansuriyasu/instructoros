'use server';
/**
 * @fileOverview Extracts business expense details from a receipt image.
 */

import { googleAI } from '@genkit-ai/google-genai';
import { ai } from '@/ai/genkit';
import {
  ReceiptExpenseDetailsSchema,
  type ReceiptExpenseDetails,
} from './types';

export type ExtractReceiptExpenseResult =
  | { ok: true; details: ReceiptExpenseDetails }
  | { ok: false; error: string };

function getReceiptExtractionErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (/unsupported mime|unsupported.*file|image format|invalid image|media/i.test(message)) {
    return 'That receipt file is not supported. Please try a clear JPG or PNG photo.';
  }
  if (/api key|permission|unauthorized|forbidden|401|403/i.test(message)) {
    return 'The AI service is not authorized. Please check the Gemini API key in Hostinger.';
  }
  if (/quota|rate limit|resource exhausted|429/i.test(message)) {
    return 'The AI service is temporarily rate limited. Please try again shortly.';
  }
  if (/too large|payload|body|request entity|413/i.test(message)) {
    return 'That receipt is too large to scan. Please try a smaller photo or screenshot.';
  }

  return 'Could not read this receipt. Please try a clearer photo or fill the details manually.';
}

export async function extractReceiptExpense(
  receiptDataUri: string
): Promise<ReceiptExpenseDetails> {
  const llmResponse = await ai.generate({
    model: googleAI.model('gemini-2.5-flash'),
    output: { schema: ReceiptExpenseDetailsSchema },
    prompt: [
      {
        text: `You are helping a driving school owner log business expenses.

Extract expense details from this receipt image.

Rules:
- Use the final amount paid as amount, not subtotal.
- Return date as YYYY-MM-DD. If the receipt date is unclear, use an empty string.
- Choose exactly one category from the schema.
- If the receipt is gas/fuel, choose Fuel / Gas.
- If it is vehicle service, oil change, tires, repairs, or mechanic work, choose Maintenance & Repairs.
- If it is a phone, internet, app, or software bill, choose Phone & Internet or Software & Subscriptions.
- If payment method is unclear, use Other.
- Keep notes short and useful for accounting.`,
      },
      { media: { url: receiptDataUri } },
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
    throw new Error('The AI model could not extract expense details from the receipt.');
  }
  return output;
}

export async function extractReceiptExpenseSafe(
  receiptDataUri: string
): Promise<ExtractReceiptExpenseResult> {
  try {
    const details = await extractReceiptExpense(receiptDataUri);
    return { ok: true, details };
  } catch (error) {
    console.error('AI receipt extraction failed:', error);
    return { ok: false, error: getReceiptExtractionErrorMessage(error) };
  }
}
