'use client';

import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking, useUser, useTenantCollectionPath } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import { ZakatYear, FinanceAsset, FinanceLiability, ZakatPayment, FinanceLoan, FinanceSpending } from '@/lib/types';
import { useMemo } from 'react';

export function useFinance() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const yearsPath = useTenantCollectionPath('finance_years');
  const assetsPath = useTenantCollectionPath('finance_assets');
  const liabilitiesPath = useTenantCollectionPath('finance_liabilities');
  const paymentsPath = useTenantCollectionPath('finance_payments');
  const loansPath = useTenantCollectionPath('finance_loans');
  const spendingPath = useTenantCollectionPath('finance_spending');

  // References
  const yearsRef = useMemoFirebase(() => (firestore && user && yearsPath ? collection(firestore, yearsPath) : null), [firestore, user, yearsPath]);
  const assetsRef = useMemoFirebase(() => (firestore && user && assetsPath ? collection(firestore, assetsPath) : null), [firestore, user, assetsPath]);
  const liabilitiesRef = useMemoFirebase(() => (firestore && user && liabilitiesPath ? collection(firestore, liabilitiesPath) : null), [firestore, user, liabilitiesPath]);
  const paymentsRef = useMemoFirebase(() => (firestore && user && paymentsPath ? collection(firestore, paymentsPath) : null), [firestore, user, paymentsPath]);
  const loansRef = useMemoFirebase(() => (firestore && user && loansPath ? collection(firestore, loansPath) : null), [firestore, user, loansPath]);
  const spendingRef = useMemoFirebase(() => (firestore && user && spendingPath ? collection(firestore, spendingPath) : null), [firestore, user, spendingPath]);

  // Data
  const { data: years, isLoading: yearsLoading } = useCollection<ZakatYear>(yearsRef);
  const { data: assets, isLoading: assetsLoading } = useCollection<FinanceAsset>(assetsRef);
  const { data: liabilities, isLoading: liabilitiesLoading } = useCollection<FinanceLiability>(liabilitiesRef);
  const { data: payments, isLoading: paymentsLoading } = useCollection<ZakatPayment>(paymentsRef);
  const { data: loans, isLoading: loansLoading } = useCollection<FinanceLoan>(loansRef);
  const { data: spending, isLoading: spendingLoading } = useCollection<FinanceSpending>(spendingRef);

  const loading = isUserLoading || yearsLoading || assetsLoading || liabilitiesLoading || paymentsLoading || loansLoading || spendingLoading;

  // Add functions
  const addYear = async (year: Omit<ZakatYear, 'id'>) => {
    if (!yearsRef) throw new Error('Database not ready');
    return addDocumentNonBlocking(yearsRef, year);
  };
  const addAsset = async (asset: Omit<FinanceAsset, 'id'>) => {
    if (!assetsRef) throw new Error('Database not ready');
    return addDocumentNonBlocking(assetsRef, asset);
  };
  const addLiability = async (liability: Omit<FinanceLiability, 'id'>) => {
    if (!liabilitiesRef) throw new Error('Database not ready');
    return addDocumentNonBlocking(liabilitiesRef, liability);
  };
  const addPayment = async (payment: Omit<ZakatPayment, 'id'>) => {
    if (!paymentsRef) throw new Error('Database not ready');
    return addDocumentNonBlocking(paymentsRef, payment);
  };
  const addLoan = async (loan: Omit<FinanceLoan, 'id'>) => {
    if (!loansRef) throw new Error('Database not ready');
    return addDocumentNonBlocking(loansRef, loan);
  };
  const addSpending = async (item: Omit<FinanceSpending, 'id'>) => {
    if (!spendingRef) throw new Error('Database not ready');
    return addDocumentNonBlocking(spendingRef, item);
  };

  // Update functions
  const updateYear = async (year: Partial<ZakatYear> & { id: string }) => {
    if (!firestore || !yearsPath) throw new Error('Database not ready');
    return updateDocumentNonBlocking(doc(firestore, yearsPath, year.id), year);
  };
  const updateAsset = async (asset: Partial<FinanceAsset> & { id: string }) => {
    if (!firestore || !assetsPath) throw new Error('Database not ready');
    return updateDocumentNonBlocking(doc(firestore, assetsPath, asset.id), asset);
  };
  const updateLiability = async (liability: Partial<FinanceLiability> & { id: string }) => {
    if (!firestore || !liabilitiesPath) throw new Error('Database not ready');
    return updateDocumentNonBlocking(doc(firestore, liabilitiesPath, liability.id), liability);
  };
  const updatePayment = async (payment: Partial<ZakatPayment> & { id: string }) => {
    if (!firestore || !paymentsPath) throw new Error('Database not ready');
    return updateDocumentNonBlocking(doc(firestore, paymentsPath, payment.id), payment);
  };
  const updateLoan = async (loan: Partial<FinanceLoan> & { id: string }) => {
    if (!firestore || !loansPath) throw new Error('Database not ready');
    return updateDocumentNonBlocking(doc(firestore, loansPath, loan.id), loan);
  };
  const updateSpending = async (item: Partial<FinanceSpending> & { id: string }) => {
    if (!firestore || !spendingPath) throw new Error('Database not ready');
    return updateDocumentNonBlocking(doc(firestore, spendingPath, item.id), item);
  };

  // Delete functions
  const deleteYear = async (id: string) => {
    if (!firestore || !yearsPath) throw new Error('Database not ready');
    return deleteDocumentNonBlocking(doc(firestore, yearsPath, id));
  };
  const deleteAsset = async (id: string) => {
    if (!firestore || !assetsPath) throw new Error('Database not ready');
    return deleteDocumentNonBlocking(doc(firestore, assetsPath, id));
  };
  const deleteLiability = async (id: string) => {
    if (!firestore || !liabilitiesPath) throw new Error('Database not ready');
    return deleteDocumentNonBlocking(doc(firestore, liabilitiesPath, id));
  };
  const deletePayment = async (id: string) => {
    if (!firestore || !paymentsPath) throw new Error('Database not ready');
    return deleteDocumentNonBlocking(doc(firestore, paymentsPath, id));
  };
  const deleteLoan = async (id: string) => {
    if (!firestore || !loansPath) throw new Error('Database not ready');
    return deleteDocumentNonBlocking(doc(firestore, loansPath, id));
  };
  const deleteSpending = async (id: string) => {
    if (!firestore || !spendingPath) throw new Error('Database not ready');
    return deleteDocumentNonBlocking(doc(firestore, spendingPath, id));
  };

  // Helpers
  const copyAssetsToNewYear = async (oldYearId: string, newYearId: string) => {
    if (!assetsRef || !assets) throw new Error('Database not ready');
    const oldAssets = assets.filter(a => a.yearId === oldYearId);
    
    // Create new assets, pointing to new year
    for (const asset of oldAssets) {
      const { id, ...assetData } = asset; // strip original ID
      await addDocumentNonBlocking(assetsRef, {
        ...assetData,
        yearId: newYearId,
      });
    }
  };

  return {
    years, assets, liabilities, payments, loans, spending, loading,
    addYear, addAsset, addLiability, addPayment, addLoan, addSpending,
    updateYear, updateAsset, updateLiability, updatePayment, updateLoan, updateSpending,
    deleteYear, deleteAsset, deleteLiability, deletePayment, deleteLoan, deleteSpending,
    copyAssetsToNewYear,
  };
}
