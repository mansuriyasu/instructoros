import { Payment, PaymentMethod, PaymentStatus, PaymentTransaction } from './types';

export function createPaymentTransaction(
  type: PaymentTransaction['type'],
  amount: number,
  method: PaymentMethod,
  note?: string,
  date = new Date().toISOString()
): PaymentTransaction {
  return {
    id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    amount,
    method,
    date,
    note,
  };
}

export function calculatePaymentStatus(total: number, paidAmount: number): PaymentStatus {
  return total - paidAmount <= 0.009 ? 'paid' : 'unpaid';
}

export function calculateAmountDue(total: number, paidAmount: number): number {
  return Math.max(0, total - paidAmount);
}

export function isAdvanceCreditPayment(payment: Pick<Payment, 'paymentMethod' | 'items'>) {
  return (
    payment.paymentMethod === 'Advance' &&
    payment.items?.length === 1 &&
    payment.items[0]?.id === 'advance-payment'
  );
}

export function getStudentAdvanceCredit(
  payments: Payment[] | null | undefined,
  studentId: string | null | undefined,
  excludePaymentId?: string
) {
  if (!payments || !studentId) return 0;

  const advanceCreated = payments
    .filter(payment => payment.id !== excludePaymentId)
    .filter(payment => payment.studentId === studentId)
    .filter(payment => isAdvanceCreditPayment(payment))
    .reduce((sum, payment) => sum + (payment.paidAmount || payment.total || 0), 0);

  const creditUsed = payments
    .filter(payment => payment.id !== excludePaymentId)
    .filter(payment => payment.studentId === studentId)
    .filter(payment => !isAdvanceCreditPayment(payment))
    .reduce((sum, payment) => sum + (payment.creditApplied || 0), 0);

  return Math.max(0, advanceCreated - creditUsed);
}
