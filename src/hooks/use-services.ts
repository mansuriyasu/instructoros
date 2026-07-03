
"use client";

import { Service } from '@/lib/types';
import { useFirestore, useCollection, useMemoFirebase, useTenantCollectionPath, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { useMemo } from 'react';

export function useServices() {
  const firestore = useFirestore();
  const servicesPath = useTenantCollectionPath('services');
  
  const servicesCollectionRef = useMemoFirebase(
    () => (firestore && servicesPath ? collection(firestore, servicesPath) : null),
    [firestore, servicesPath]
  );
  
  const { data, isLoading } = useCollection<Service>(servicesCollectionRef);
  
  const services = useMemo(() => {
    if (!data) return [];
    return data.sort((a,b) => (a.order || 0) - (b.order || 0));
  }, [data]);

  const addService = async (service: Omit<Service, 'id' | 'order'>) => {
    if (!servicesCollectionRef) return;
    const newService = { ...service, order: (services?.length ?? 0) + 1 };
    return addDocumentNonBlocking(servicesCollectionRef, newService);
  };

  const updateService = async (service: Service) => {
    if (!firestore || !servicesPath) return;
    const serviceRef = doc(firestore, servicesPath, service.id);
    const { id, ...serviceData } = service;
    return updateDocumentNonBlocking(serviceRef, serviceData);
  };
  
  const deleteService = async (serviceId: string) => {
    if (!firestore || !servicesPath) return;
    const serviceRef = doc(firestore, servicesPath, serviceId);
    return deleteDocumentNonBlocking(serviceRef);
  };

  const updateServiceOrder = async (orderedServices: Service[]) => {
    if (!firestore || !servicesPath) return;
    const batch = writeBatch(firestore);
    orderedServices.forEach((service, index) => {
      const serviceRef = doc(firestore, servicesPath, service.id);
      batch.update(serviceRef, { order: index + 1 });
    });
    return batch.commit();
  };

  return { services, loading: isLoading, addService, updateService, deleteService, updateServiceOrder };
}
