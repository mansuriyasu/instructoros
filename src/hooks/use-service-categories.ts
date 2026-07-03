"use client";

import { ServiceCategory } from '@/lib/types';
import { useFirestore, useCollection, useMemoFirebase, useTenantCollectionPath } from '@/firebase';
import { collection, doc, writeBatch, runTransaction } from 'firebase/firestore';
import { useMemo } from 'react';

export function useServiceCategories() {
  const firestore = useFirestore();
  const categoriesPath = useTenantCollectionPath('serviceCategories');
  const servicesPath = useTenantCollectionPath('services');
  
  const categoriesCollectionRef = useMemoFirebase(
    () => (firestore && categoriesPath ? collection(firestore, categoriesPath) : null),
    [firestore, categoriesPath]
  );
  
  const { data: rawData, isLoading } = useCollection<ServiceCategory>(categoriesCollectionRef);
  
  const categories = useMemo(() => {
    if (!rawData) return [];
    return rawData.sort((a,b) => a.order - b.order);
  }, [rawData]);
  
  const saveCategoryOrder = async (orderedCategories: ServiceCategory[]) => {
    if (!firestore || !categoriesPath) return;
    const batch = writeBatch(firestore);
    orderedCategories.forEach((category) => {
      const categoryRef = doc(firestore, categoriesPath, category.id);
      batch.set(categoryRef, category, { merge: true });
    });
    return batch.commit();
  };

  const updateCategoryName = async (oldName: string, newName: string) => {
    if (!firestore || !categoriesPath || !servicesPath) return;

    await runTransaction(firestore, async (transaction) => {
      // 1. Update the category document itself
      const oldCategoryId = oldName.toLowerCase().replace(/\s+/g, '-');
      const newCategoryId = newName.toLowerCase().replace(/\s+/g, '-');
      
      const oldCategoryRef = doc(firestore, categoriesPath, oldCategoryId);
      const oldCategorySnap = await transaction.get(oldCategoryRef);
      if (!oldCategorySnap.exists()) {
        throw new Error(`Category document for "${oldName}" not found.`);
      }
      
      const categoryData = oldCategorySnap.data();
      const newCategoryRef = doc(firestore, categoriesPath, newCategoryId);
      
      transaction.set(newCategoryRef, { ...categoryData, name: newName, id: newCategoryId });
      transaction.delete(oldCategoryRef);

      // 2. Find all services with the old category name and update them
      // We cannot query inside a transaction, so we update directly using the batch later or inside if we don't care about reading
    });

    // We do a batch update for services
    const { getDocs, query, where, writeBatch: fbWriteBatch } = await import('firebase/firestore');
    const servicesQuery = query(collection(firestore, servicesPath), where('category', '==', oldName));
    const snapshot = await getDocs(servicesQuery);
    
    if (!snapshot.empty) {
      const batch = fbWriteBatch(firestore);
      snapshot.docs.forEach(docSnap => {
        batch.update(docSnap.ref, { category: newName });
      });
      await batch.commit();
    }
  };

  const deleteCategory = async (categoryName: string) => {
    if (!firestore || !categoriesPath || !servicesPath) return;

    await runTransaction(firestore, async (transaction) => {
      // 1. Delete the category document
      const categoryId = categoryName.toLowerCase().replace(/\s+/g, '-');
      const categoryRef = doc(firestore, categoriesPath, categoryId);
      transaction.delete(categoryRef);

      // 2. Find all services with this category and unset the category field
      // We do this outside the transaction using batch
    });

    const { getDocs, query, where, writeBatch: fbWriteBatch } = await import('firebase/firestore');
    const servicesQuery = query(collection(firestore, servicesPath), where('category', '==', categoryName));
    const snapshot = await getDocs(servicesQuery);
    
    if (!snapshot.empty) {
      const batch = fbWriteBatch(firestore);
      snapshot.docs.forEach(docSnap => {
        batch.update(docSnap.ref, { category: '' }); // or delete the field
      });
      await batch.commit();
    }
  };

  return { categories, loading: isLoading, saveCategoryOrder, updateCategoryName, deleteCategory };
}
