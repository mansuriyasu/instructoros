import { test, describe } from 'node:test';
import assert from 'node:assert';
import { getLessonPaymentRecordState, isLessonUnbilled } from '../src/lib/payment-utils';
import { Payment } from '../src/lib/types';

describe('isLessonUnbilled', () => {
  const partlyPaidBill = {
    id: 'bill1',
    studentId: 's1',
    items: [{ id: 'svc', billItemId: 'b1', name: 'G2 Lesson', price: 600, quantity: 1, date: '2026-11-01', eventId: 'lesson1' }],
    total: 600,
    paidAmount: 100,
    paymentMethod: 'Cash',
  } as unknown as Payment;

  test('a lesson on a partly paid bill is already billed', () => {
    const state = getLessonPaymentRecordState({ id: 'lesson1', studentId: 's1' }, [partlyPaidBill]);
    assert.strictEqual(state, 'unpaid');
    assert.strictEqual(isLessonUnbilled(state), false);
  });

  test('a lesson on no bill is billable', () => {
    const state = getLessonPaymentRecordState({ id: 'lesson2', studentId: 's1' }, [partlyPaidBill]);
    assert.strictEqual(isLessonUnbilled(state), true);
  });
});
