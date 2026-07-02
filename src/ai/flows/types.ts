import { z } from 'genkit';

/**
 * @fileOverview Type definitions for AI flows.
 */

export const LicenseDetailsSchema = z.object({
  name: z.string().describe('The full name of the license holder.'),
  address: z.string().describe('The full address of the license holder.'),
  birthdate: z
    .string()
    .describe('The date of birth of the license holder in YYYYMMDD format.'),
  licenseNumber: z.string().describe("The driver's license number."),
  licenseExpiry: z
    .string()
    .describe('The expiration date of the license in YYYYMMDD format.'),
  faceBoundingBox: z
    .array(z.number())
    .length(4)
    .optional()
    .describe('The bounding box of the person\'s face in the image in [ymin, xmin, ymax, xmax] format, scaled from 0 to 1000. If no face is found, omit this field.'),
});

export type LicenseDetails = z.infer<typeof LicenseDetailsSchema>;

export const ReceiptExpenseDetailsSchema = z.object({
  date: z
    .string()
    .describe('The receipt or transaction date in YYYY-MM-DD format. Use an empty string if unknown.'),
  amount: z
    .number()
    .describe('The final total amount paid, including tax. Use 0 if unknown.'),
  category: z
    .enum([
      'Fuel / Gas',
      'Maintenance & Repairs',
      'Insurance',
      'Licensing & Permits',
      'Car Wash / Cleaning',
      'Marketing & Ads',
      'Software & Subscriptions',
      'Phone & Internet',
      'Tolls & Parking',
      'Accounting & Legal',
      'Other',
    ])
    .describe('The best business expense category for this driving academy receipt.'),
  paymentMethod: z
    .enum(['Credit Card', 'Debit Card', 'Cash', 'Bank Transfer', 'Other'])
    .describe('The payment method shown on the receipt, or Other if unclear.'),
  vendor: z
    .string()
    .describe('The merchant, store, vendor, or payee name. Use an empty string if unknown.'),
  notes: z
    .string()
    .describe('A short plain-English description of what this receipt appears to be for.'),
});

export type ReceiptExpenseDetails = z.infer<typeof ReceiptExpenseDetailsSchema>;

export const ExamDetailsSchema = z.object({
  studentName: z.string().describe('The name of the student taking the exam. Use an empty string if unknown.'),
  examCenter: z.string().describe('The name and location of the DriveTest center or exam center. E.g. "Peterborough DriveTest".'),
  examDate: z.string().describe('The date of the exam strictly in YYYY-MM-DD format.'),
  examTime: z.string().describe('The time of the exam strictly in 24-hour HH:mm format (e.g., 14:30 for 2:30 PM, 09:15 for 9:15 AM).'),
});

export type ExamDetails = z.infer<typeof ExamDetailsSchema>;

export const TravelTimeEstimationSchema = z.object({
  travelTimeMinutes: z.number().describe('The estimated driving time in minutes between the two locations.'),
});

export type TravelTimeEstimation = z.infer<typeof TravelTimeEstimationSchema>;
