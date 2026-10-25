import type {
  ExamDetails,
  LicenseDetails,
  ReceiptExpenseDetails,
} from '@/ai/flows/types';

type OcrResult = {
  text: string;
  confidence: number;
};

let ocrQueue: Promise<unknown> = Promise.resolve();

function withOcrLock<T>(work: () => Promise<T>): Promise<T> {
  const result = ocrQueue.then(work, work);
  ocrQueue = result.catch(() => undefined);
  return result;
}

function isSupportedImageDataUri(value: string): boolean {
  return /^data:image\/(?:jpeg|png|webp|bmp);base64,/i.test(value);
}

export async function recognizeDocumentText(dataUri: string): Promise<OcrResult | null> {
  if (!isSupportedImageDataUri(dataUri)) return null;
  // Some managed Node hosts block worker-thread initialization. Keep local OCR
  // available for development and for production hosts that explicitly enable it.
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_LOCAL_OCR !== 'true') {
    return null;
  }

  return withOcrLock(async () => {
    const { mkdir } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { createWorker } = await import('tesseract.js');
    const cachePath = join(tmpdir(), 'instructoros-tesseract');
    await mkdir(cachePath, { recursive: true });
    const worker = await createWorker('eng', undefined, { cachePath });
    try {
      const result = await worker.recognize(dataUri);
      const text = result.data.text.replace(/\r/g, '').trim();
      if (!text) return null;
      return { text, confidence: result.data.confidence };
    } finally {
      await worker.terminate();
    }
  });
}

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function validDate(year: number, month: number, day: number): boolean {
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return candidate.getUTCFullYear() === year && candidate.getUTCMonth() === month - 1 && candidate.getUTCDate() === day;
}

function normalizeDate(year: number, month: number, day: number, compact = false): string {
  if (!validDate(year, month, day)) return '';
  return compact ? `${year}${pad(month)}${pad(day)}` : `${year}-${pad(month)}-${pad(day)}`;
}

function parseDate(value: string, compact = false): string {
  const iso = value.match(/\b(20\d{2}|19\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (iso) return normalizeDate(Number(iso[1]), Number(iso[2]), Number(iso[3]), compact);

  const numeric = value.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2}|19\d{2})\b/);
  if (numeric) return normalizeDate(Number(numeric[3]), Number(numeric[1]), Number(numeric[2]), compact);

  const named = value.match(
    /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s+(20\d{2}|19\d{2})\b/i
  );
  if (named) {
    return normalizeDate(Number(named[3]), MONTHS[named[1].toLowerCase()], Number(named[2]), compact);
  }
  return '';
}

function parseTime(value: string): string {
  const match = value.match(/\b(\d{1,2})[:.](\d{2})\s*(a\.?m\.?|p\.?m\.?)?\b/i);
  if (!match) return '';
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return '';
  const meridiem = match[3]?.replace(/\./g, '').toLowerCase();
  if (meridiem === 'pm' && hour < 12) hour += 12;
  if (meridiem === 'am' && hour === 12) hour = 0;
  return `${pad(hour)}:${pad(minute)}`;
}

function labeledLine(text: string, labels: RegExp): string {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const index = lines.findIndex((line) => labels.test(line));
  if (index < 0) return '';
  const current = lines[index].replace(labels, '').replace(/^\s*[:#-]\s*/, '').trim();
  return current || lines[index + 1] || '';
}

function cleanName(value: string): string {
  return value
    .replace(/[^A-Za-zÀ-ÿ' -]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseExamOcr(text: string, confidence: number): ExamDetails | null {
  if (confidence < 45) return null;
  const examDate = parseDate(labeledLine(text, /(?:road\s*test|exam|appointment)\s*date/i) || text);
  const timeLine = labeledLine(text, /(?:road\s*test|exam|appointment)\s*time/i);
  const examTime = parseTime(timeLine);
  const studentName = cleanName(labeledLine(text, /(?:student|candidate|customer)\s*name|name\s*of\s*(?:student|candidate)/i));
  const examCenter = labeledLine(text, /(?:drive\s*test|exam|test)\s*(?:centre|center|location)/i)
    .replace(/^\s*[:#-]\s*/, '')
    .trim();

  if (!examDate || !examTime || (!studentName && !examCenter)) return null;
  return { studentName, examCenter, examDate, examTime };
}

function parseLabeledCompactDate(text: string, labels: RegExp): string {
  return parseDate(labeledLine(text, labels), true);
}

export function parseLicenseOcr(text: string, confidence: number): LicenseDetails | null {
  if (confidence < 55) return null;
  const flattened = text.replace(/\s+/g, ' ');
  const licenseMatch = flattened.match(/\b([A-Z])\s*[- ]?((?:\d[ -]?){14})\b/i);
  const licenseNumber = licenseMatch
    ? `${licenseMatch[1]}${licenseMatch[2].replace(/\D/g, '')}`.toUpperCase()
    : '';
  const birthdate = parseLabeledCompactDate(text, /(?:date\s*of\s*birth|birth\s*date|dob)/i);
  const licenseExpiry = parseLabeledCompactDate(text, /(?:expiry|expires?|exp(?:iry)?(?:\.?\s*date)?)/i);
  const name = cleanName(labeledLine(text, /(?:full\s*)?name/i));
  const address = labeledLine(text, /address/i).replace(/\s+/g, ' ').trim();

  if (!licenseNumber || !birthdate || !licenseExpiry || !name || !address) return null;
  return { name, address, birthdate, licenseNumber, licenseExpiry };
}

function inferReceiptCategory(text: string): ReceiptExpenseDetails['category'] {
  if (/\b(gas|fuel|petro|shell|esso|ultramar)\b/i.test(text)) return 'Fuel / Gas';
  if (/\b(oil|tire|tyre|repair|mechanic|service|maintenance)\b/i.test(text)) return 'Maintenance & Repairs';
  if (/\b(car\s*wash|cleaning|detail)\b/i.test(text)) return 'Car Wash / Cleaning';
  if (/\b(parking|toll|407\s*etr)\b/i.test(text)) return 'Tolls & Parking';
  if (/\b(phone|mobile|internet|rogers|bell|telus)\b/i.test(text)) return 'Phone & Internet';
  if (/\b(subscription|software|hosting|domain|app)\b/i.test(text)) return 'Software & Subscriptions';
  if (/\b(insurance)\b/i.test(text)) return 'Insurance';
  return 'Other';
}

function inferPaymentMethod(text: string): ReceiptExpenseDetails['paymentMethod'] {
  if (/\bvisa|mastercard|amex|credit\b/i.test(text)) return 'Credit Card';
  if (/\bdebit|interac\b/i.test(text)) return 'Debit Card';
  if (/\bcash\b/i.test(text)) return 'Cash';
  if (/\be-?transfer|bank\s*transfer\b/i.test(text)) return 'Bank Transfer';
  return 'Other';
}

export function parseReceiptOcr(text: string, confidence: number): ReceiptExpenseDetails | null {
  if (confidence < 50) return null;
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const totalLine = [...lines].reverse().find((line) => /\b(?:grand\s*)?total\b/i.test(line));
  const amountMatch = totalLine?.match(/(?:\$|CAD\s*)?(\d{1,6}[.,]\d{2})\b/i);
  const amount = amountMatch ? Number(amountMatch[1].replace(',', '.')) : 0;
  const date = parseDate(labeledLine(text, /(?:transaction\s*)?date/i) || text);
  const vendor = lines.find((line) => /[A-Za-z]{3}/.test(line) && !/receipt|invoice/i.test(line)) || '';
  if (!date || !amount || !vendor) return null;

  return {
    date,
    amount,
    category: inferReceiptCategory(text),
    paymentMethod: inferPaymentMethod(text),
    vendor: vendor.slice(0, 100),
    notes: `Receipt from ${vendor}`.slice(0, 160),
  };
}
