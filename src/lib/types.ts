
export type StudentStatus = 'active' | 'booked' | 'on-hold' | 'deactivated';
export type LicenseType = 'G' | 'G2';
export type PaymentMethod = 'Cash' | 'E-Transfer' | 'Other' | 'Unpaid' | 'Advance';
export type PaymentStatus = 'paid' | 'unpaid';
export type LessonStatus = 'scheduled' | 'no-show' | 'cancelled';
export type PaymentTransactionType = 'payment' | 'adjustment' | 'credit-created' | 'credit-applied';

export interface Student {
  id: string;
  name: string;
  mobileNumber: string;
  email?: string;
  address: string;
  birthdate: string; // YYYYMMDD
  licenseNumber: string;
  licenseExpiry: string; // YYYYMMDD
  licenseType: LicenseType;
  status: StudentStatus;
  comments: string;
  registrationDate: string;
  avatarUrl?: string; // Optional face image stored as base64 or URL
  licenseImageUrl?: string; // Optional full license image URL in Firebase Storage
  tags?: string[];
  assignedInstructorIds?: string[];
}

export interface PackageComponent {
  serviceId: string; // component Service id at definition time
  name: string; // snapshot of the component name
  quantity: number; // units included, >= 1
}

export interface Service {
  id: string;
  name: string;
  price: number;
  cost?: number;
  discount?: number;
  order: number;
  category?: string;
  duration?: number; // in minutes
  packageItems?: PackageComponent[]; // non-empty => this service is a package
}

export interface ServiceCategory {
    id: string;
    name: string;
    order: number;
}

export interface BillItem extends Omit<Service, 'order' | 'discount' | 'category' | 'duration'>{
  billItemId: string; // To uniquely identify items in a bill
  date: string; // ISO 8601
  quantity: number;
  eventId?: string; // schedule event this line was billed from, when applicable
}

export interface Payment {
  id:string;
  studentId: string | null; // null for walk-in
  studentName: string;
  items: BillItem[];
  subtotal: number;
  discount: number;
  tax: number;
  taxLabel?: string;
  taxRate?: number;
  total: number;
  totalCost: number;
  paidAmount: number;
  amountDue: number;
  paymentMethod: PaymentMethod;
  paymentDate: string; // ISO 8601
  status: PaymentStatus;
  notes?: string;
  instructorId?: string | null;
  creditApplied?: number;
  transactions?: PaymentTransaction[];
}

export interface PaymentTransaction {
  id: string;
  type: PaymentTransactionType;
  amount: number;
  method: PaymentMethod;
  date: string;
  note?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO 8601
  end: string;   // ISO 8601
  studentId: string | null;
  studentName: string;
  studentAddress?: string;
  services: { id: string; name: string; price?: number; cost?: number; discount?: number; }[];
  notes?: string;
  googleEventId?: string;
  googleEventIds?: Record<string, string>;
  paymentId?: string;
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  instructorId?: string | null;
  lessonStatus?: LessonStatus;
  examCenter?: string;
  examDateTime?: string;
  examImageDataUri?: string;
}

export type EvaluationTestType = 'G2' | 'G';
export type EvaluationItemStatus = 'ok' | 'minor' | 'major';
export type EvaluationVerdict = 'pass' | 'borderline' | 'fail';

export interface EvaluationItem {
  id: string;
  name: string;
  status: EvaluationItemStatus;
  tags: string[];
  category?: string; // section id from evaluation-criteria; absent on older records
}

export interface Evaluation {
  id: string;
  studentId: string;
  lessonId: string;
  testType: EvaluationTestType;
  date: string;
  area: string;
  instructor: string;
  instructorUid: string;
  createdByUid: string;
  items: EvaluationItem[];
  minor_count: number;
  major_count: number;
  autofails: string[];
  verdict: EvaluationVerdict;
  notes: string;
  created_at: string;
  updated_at?: string;
}

export interface InstructorOption {
  uid: string;
  displayName?: string;
  email?: string;
  role?: string;
}

// ---- Finance & Zakat Models ----

export interface ZakatYear {
  id: string;
  name: string; // e.g. "Zakat 2026"
  zakatDate: string; // ISO 8601
  baseCurrency: string; // Default 'CAD'
  nisabMethod: 'gold' | 'silver';
  goldPrice: number; // per gram
  silverPrice: number; // per gram
  exchangeRateINR: number; // CAD to INR rate
}

export type AssetCategory = 'Cash' | 'Bank' | 'Gold' | 'Silver' | 'Investment' | 'TFSA' | 'RRSP' | 'FHSA' | 'India Account' | 'Loan Receivable' | 'Business Inventory' | 'Other';

export interface FinanceAsset {
  id: string;
  yearId: string;
  name: string;
  owner: string;
  category: AssetCategory;
  currency: string;
  originalValue: number;
  exchangeRate: number; // to CAD
  valueInCAD: number;
  zakatablePercentage: number; // 0 to 100
  zakatableValue: number;
  notes?: string;
}

export interface FinanceLiability {
  id: string;
  yearId: string;
  name: string;
  personCompany: string;
  amount: number;
  currency: string;
  exchangeRate: number; // to CAD
  valueInCAD: number;
  dueDate: string; // ISO 8601
  deductible: boolean; // Only short-term deductibles
  notes?: string;
}

export interface ZakatPayment {
  id: string;
  yearId: string;
  date: string; // ISO 8601
  recipientName: string;
  amount: number;
  currency: string;
  exchangeRate: number; // to CAD
  valueInCAD: number;
  method: 'Cash' | 'Bank Transfer' | 'E-transfer' | 'Other';
  notes?: string;
  receiptAttachment?: string;
}

export interface FinanceLoan {
  id: string;
  personName: string;
  type: 'gave' | 'borrowed';
  originalAmount: number;
  amountPaid: number;
  remainingBalance: number;
  currency: string;
  date: string; // ISO 8601
  status: 'Open' | 'Partial' | 'Paid';
  notes?: string;
}

export interface FinanceSpending {
  id: string;
  date: string; // ISO 8601
  category: string;
  description: string;
  amount: number;
  currency: string;
  paid: boolean;
  relatedPerson?: string;
  notes?: string;
}

export interface WhatsAppLog {
  id: string;
  date: string; // ISO 8601
  to: string;
  body: string;
  status: 'sent' | 'error';
  channel?: 'whatsapp';
  errorMessage?: string;
}
