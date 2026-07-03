"use client";

import { useState, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking, useUser, useTenantCollectionPath } from '@/firebase';
import { collection, doc } from 'firebase/firestore';

export type ExpenseCategory = 
  | 'Fuel / Gas' 
  | 'Maintenance & Repairs' 
  | 'Insurance' 
  | 'Licensing & Permits' 
  | 'Car Wash / Cleaning' 
  | 'Marketing & Ads' 
  | 'Software & Subscriptions'
  | 'Phone & Internet' 
  | 'Tolls & Parking' 
  | 'Accounting & Legal'
  | 'Other';

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
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
  'Other'
];

export type PersonalExpenseCategory =
  | 'Groceries'
  | 'Dining & Takeout'
  | 'Housing / Rent / Mortgage'
  | 'Utilities (Hydro, Water, Gas)'
  | 'Personal Phone & Internet'
  | 'Health & Medical'
  | 'Personal Vehicle (Non-Business)'
  | 'Clothing & Shopping'
  | 'Entertainment & Hobbies'
  | 'Family & Kids'
  | 'Travel & Vacations'
  | 'Gifts & Donations'
  | 'Other Personal';

export const PERSONAL_EXPENSE_CATEGORIES: PersonalExpenseCategory[] = [
  'Groceries',
  'Dining & Takeout',
  'Housing / Rent / Mortgage',
  'Utilities (Hydro, Water, Gas)',
  'Personal Phone & Internet',
  'Health & Medical',
  'Personal Vehicle (Non-Business)',
  'Clothing & Shopping',
  'Entertainment & Hobbies',
  'Family & Kids',
  'Travel & Vacations',
  'Gifts & Donations',
  'Other Personal'
];

export type ExpenseType = 'business' | 'personal';

export type BusinessExpense = {
  id: string;
  expenseType?: ExpenseType; // Defaults to 'business' for old records
  date: string; // YYYY-MM-DD
  amount: number;
  category: ExpenseCategory | PersonalExpenseCategory | string;
  vendor: string;
  paymentMethod?: string;
  notes?: string;
  receiptUrl?: string; // base64 string
  createdAt: string; // ISO string
};

export function useBusinessExpenses() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const expensesPath = useTenantCollectionPath('business_expenses');

  const expensesCollectionRef = useMemoFirebase(
    () => (firestore && user && expensesPath ? collection(firestore, expensesPath) : null),
    [firestore, user, expensesPath]
  );

  const { data: expensesUnsorted, isLoading } = useCollection<BusinessExpense>(expensesCollectionRef);
  
  // Sort expenses by date descending
  const expenses = expensesUnsorted ? [...expensesUnsorted].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) : [];

  const addExpense = async (expense: Omit<BusinessExpense, 'id' | 'createdAt'>) => {
    if (!user) {
      throw new Error('Firebase sign-in is not ready. Please refresh the app and try again.');
    }
    if (!expensesCollectionRef) {
      throw new Error('The expenses database is not ready yet. Please try again.');
    }
    const newExpense = {
      ...expense,
      createdAt: new Date().toISOString(),
    };
    return addDocumentNonBlocking(expensesCollectionRef, newExpense);
  };

  const updateExpense = async (id: string, updates: Partial<BusinessExpense>) => {
    if (!user) {
      throw new Error('Firebase sign-in is not ready. Please refresh the app and try again.');
    }
    if (!firestore) {
      throw new Error('The expenses database is not ready yet. Please try again.');
    }
    if (!expensesPath) {
      throw new Error('The expenses database is not ready yet. Please try again.');
    }
    const expenseRef = doc(firestore, expensesPath, id);
    return updateDocumentNonBlocking(expenseRef, updates);
  };

  const deleteExpense = async (id: string) => {
    if (!user) {
      throw new Error('Firebase sign-in is not ready. Please refresh the app and try again.');
    }
    if (!firestore) {
      throw new Error('The expenses database is not ready yet. Please try again.');
    }
    if (!expensesPath) {
      throw new Error('The expenses database is not ready yet. Please try again.');
    }
    const expenseRef = doc(firestore, expensesPath, id);
    return deleteDocumentNonBlocking(expenseRef);
  };

  return { 
    expenses, 
    isLoaded: !isUserLoading && !isLoading,
    addExpense, 
    updateExpense, 
    deleteExpense 
  };
}
