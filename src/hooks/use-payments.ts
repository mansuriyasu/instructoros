
'use client';

import { useMemo, useCallback } from 'react';
import { Payment } from '@/lib/types';
import {
  useFirestore,
  useCollection,
  useMemoFirebase,
  addDocumentNonBlocking,
  updateDocumentNonBlocking,
  deleteDocumentNonBlocking,
} from '@/firebase';
import { collection, doc } from 'firebase/firestore';

export function usePayments() {
  const firestore = useFirestore();

  const paymentsCollectionRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'payments') : null),
    [firestore]
  );

  const { data: payments, isLoading } =
    useCollection<Payment>(paymentsCollectionRef);

  const addPayment = async (payment: Omit<Payment, 'id'>) => {
    if (!paymentsCollectionRef) return;
    return addDocumentNonBlocking(paymentsCollectionRef, payment);
  };

  const updatePayment = async (payment: Payment) => {
    if (!firestore) return;
    const paymentRef = doc(firestore, 'payments', payment.id);
    return updateDocumentNonBlocking(paymentRef, payment);
  };

  const deletePayment = async (paymentId: string) => {
    if (!firestore) return;
    const paymentRef = doc(firestore, 'payments', paymentId);
    return deleteDocumentNonBlocking(paymentRef);
  };

  const getPaymentById = useCallback(
    (id: string) => {
      return payments?.find(p => p.id === id) ?? null;
    },
    [payments]
  );

  const totalRevenue = useMemo(() => {
    if (!payments) return 0;
    return payments
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + p.total, 0);
  }, [payments]);

  const outstandingPayments = useMemo(() => {
    if (!payments) return 0;
    return payments
      .filter(p => p.status === 'unpaid')
      .reduce((sum, p) => sum + p.total, 0);
  }, [payments]);

  const sortedPayments = useMemo(() => {
    if (!payments) return [];
    return [...payments].sort(
      (a, b) =>
        new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
    );
  }, [payments]);

  return {
    payments: sortedPayments,
    loading: isLoading,
    addPayment,
    updatePayment,
    deletePayment,
    getPaymentById,
    totalRevenue,
    outstandingPayments,
  };
}
