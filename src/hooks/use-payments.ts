
'use client';

import { useMemo, useCallback } from 'react';
import { Payment } from '@/lib/types';
import {
  useFirestore,
  useCollection,
  useMemoFirebase,
  useSession,
  useTenantCollectionPath,
  addDocumentNonBlocking,
  updateDocumentNonBlocking,
  deleteDocumentNonBlocking,
} from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';

export function usePayments() {
  const firestore = useFirestore();
  const { user, role } = useSession();
  const paymentsPath = useTenantCollectionPath('payments');

  const paymentsCollectionRef = useMemoFirebase(
    () => (firestore && paymentsPath ? collection(firestore, paymentsPath) : null),
    [firestore, paymentsPath]
  );

  const paymentsQuery = useMemoFirebase(
    () => {
      if (!paymentsCollectionRef) return null;
      if (role === 'schoolInstructor' && user) {
        return query(paymentsCollectionRef, where('instructorId', '==', user.uid));
      }
      return paymentsCollectionRef;
    },
    [paymentsCollectionRef, role, user]
  );

  const { data: payments, isLoading } =
    useCollection<Payment>(paymentsQuery);

  const addPayment = async (payment: Omit<Payment, 'id'>) => {
    if (!paymentsCollectionRef) return;
    return addDocumentNonBlocking(paymentsCollectionRef, {
      ...payment,
      instructorId: payment.instructorId || user?.uid || null,
    });
  };

  const updatePayment = async (payment: Payment) => {
    if (!firestore || !paymentsPath) return;
    const paymentRef = doc(firestore, paymentsPath, payment.id);
    return updateDocumentNonBlocking(paymentRef, payment);
  };

  const deletePayment = async (paymentId: string) => {
    if (!firestore || !paymentsPath) return;
    const paymentRef = doc(firestore, paymentsPath, paymentId);
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
