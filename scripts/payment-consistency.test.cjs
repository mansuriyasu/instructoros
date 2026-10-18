const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, imports = {}) {
  const compiled = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText,
    { module: compiled, exports: compiled.exports, require: name => imports[name] || require(name), Date },
  );
  return compiled.exports;
}

const { getLessonPaymentRecordState } = load('src/lib/payment-utils.ts', {
  './types': {},
});

const lesson = {
  id: 'lesson-1',
  studentId: 'student-1',
  paymentId: 'payment-1',
  paymentStatus: 'paid',
};

const payment = {
  id: 'payment-1',
  studentId: 'student-1',
  items: [{ id: 'service', eventId: 'lesson-1' }],
  total: 100,
  paidAmount: 100,
  paymentMethod: 'Cash',
};

test('a paid lesson requires a matching Payment History record', () => {
  assert.equal(getLessonPaymentRecordState(lesson, []), 'missing-record');
  assert.equal(getLessonPaymentRecordState(lesson, [payment]), 'paid');
});

test('the actual balance overrides a stale paid event flag', () => {
  assert.equal(
    getLessonPaymentRecordState(lesson, [{ ...payment, paidAmount: 25 }]),
    'unpaid',
  );
});

test('older payments can be found from their lesson item link', () => {
  assert.equal(
    getLessonPaymentRecordState({ ...lesson, paymentId: undefined }, [payment]),
    'paid',
  );
});

test('a payment for another student cannot mark the lesson paid', () => {
  assert.equal(
    getLessonPaymentRecordState(lesson, [{ ...payment, studentId: 'student-2' }]),
    'missing-record',
  );
});

test('a walk-in payment cannot mark a student lesson paid', () => {
  assert.equal(
    getLessonPaymentRecordState(lesson, [{ ...payment, studentId: null }]),
    'missing-record',
  );
});

test('the explicit payment id wins if an older bill also contains the lesson', () => {
  const oldUnpaidBill = { ...payment, id: 'old-payment', paidAmount: 0 };
  assert.equal(
    getLessonPaymentRecordState(lesson, [oldUnpaidBill, payment]),
    'paid',
  );
});
