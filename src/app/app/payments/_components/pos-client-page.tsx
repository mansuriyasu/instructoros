'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { BillItem, CalendarEvent, Payment, Service, Student } from '@/lib/types';
import { ServiceSelection } from './service-selection';
import { CurrentBill } from './current-bill';
import { useSearchParams, useRouter } from 'next/navigation';
import { usePayments } from '@/hooks/use-payments';
import { Skeleton } from '@/components/ui/skeleton';
import { useStudents } from '@/hooks/use-students';
import { useServices } from '@/hooks/use-services';
import { useEvents } from '@/hooks/use-events';
import { StudentSelector } from './student-selector';
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from '@/components/ui/sheet';
import { BadgeDollarSign, ShoppingCart } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function PosClientPage() {
  const [items, setItems] = useState<BillItem[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [activeBill, setActiveBill] = useState<Payment | null>(null);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

  const searchParams = useSearchParams();
  const router = useRouter();
  
  const { payments, loading: paymentsLoading, getPaymentById } = usePayments();
  const { students, loading: studentsLoading } = useStudents();
  const { services, loading: servicesLoading } = useServices();
  const { events, loading: eventsLoading } = useEvents();
  const importedUrlItemsRef = useRef<string | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  
  const paymentIdForEdit = searchParams.get('edit');
  const studentIdFromUrl = searchParams.get('studentId');
  const serviceIdFromUrl = searchParams.get('serviceId');
  const serviceIdsFromUrl = searchParams.get('serviceIds');
  const eventIdsFromUrl = searchParams.get('eventIds');

  const sortedStudents = useMemo(() => {
    if (!students) return [];
    // Sort all students by name for the searchable dropdown
    return [...students].sort((a, b) => a.name.localeCompare(b.name));
  }, [students]);

  const currentSubtotal = useMemo(() => items.reduce((sum, item) => sum + (item.price * item.quantity), 0), [items]);

  const addServiceToBill = useCallback((service: Service) => {
    setItems(prev => {
        // Always add a new item instead of merging.
        // This gives the instructor more control over individual bill items,
        // like setting different dates/times for separate lessons.
        const finalPrice = service.discount ? service.price - service.discount : service.price;
        const billItem: BillItem = {
          id: service.id,
          name: service.name,
          price: finalPrice,
          cost: service.cost || 0,
          billItemId: `${service.id}-${Date.now()}`, // Unique ID for each bill item
          date: new Date().toISOString(),
          quantity: 1,
        };
        return [...prev, billItem];
    });
  }, []);

  const createBillItemsFromEvents = useCallback((selectedEvents: CalendarEvent[]) => {
    if (!services) return [];

    return selectedEvents.flatMap(event => {
      return (event.services || []).map((eventService, index) => {
        const serviceDetails = services.find(service => service.id === eventService.id || service.name === eventService.name);
        const basePrice = eventService.price ?? serviceDetails?.price ?? 0;
        const discount = eventService.discount ?? serviceDetails?.discount ?? 0;
        const finalPrice = basePrice - discount;

        return {
          id: eventService.id,
          name: eventService.name,
          price: finalPrice,
          cost: eventService.cost ?? serviceDetails?.cost ?? 0,
          billItemId: `${event.id}-${eventService.id}-${index}`,
          date: event.start,
          quantity: 1,
        };
      });
    });
  }, [services]);

  // Effect to handle initial loading state
  useEffect(() => {
    if(!studentsLoading && !paymentsLoading && !servicesLoading && !eventsLoading) {
      setIsLoading(false);
    }
  }, [studentsLoading, paymentsLoading, servicesLoading, eventsLoading]);

  // Effect to handle editing a specific payment
  useEffect(() => {
    if (paymentIdForEdit && !isLoading && students && payments && services) {
      const paymentToEdit = getPaymentById(paymentIdForEdit);
      if (paymentToEdit) {
        setActiveBill(paymentToEdit);
        
        const itemsWithCost = paymentToEdit.items.map(item => {
            return {
                ...item,
                cost: item.cost ?? 0,
                quantity: item.quantity || 1, // Ensure quantity exists
            };
        });
        setItems(itemsWithCost);

        if (paymentToEdit.studentId) {
          const student = students.find(s => s.id === paymentToEdit.studentId);
          setSelectedStudent(student || null);
        } else {
          setSelectedStudent(null);
        }
      } else {
        router.replace('/app/payments');
      }
    }
  }, [paymentIdForEdit, isLoading, students, payments, services, getPaymentById, router]);

  const loadBillForStudent = useCallback((studentId: string, onComplete?: () => void) => {
    if (!students || !payments || !services) return; 

    const student = students.find(s => s.id === studentId) || null;
    setSelectedStudent(student);

    if (student) {
      const existingUnpaidBill = payments.find(p => p.studentId === student.id && p.status !== 'paid');
      if (existingUnpaidBill) {
        setActiveBill(existingUnpaidBill);
        
        const itemsWithCost = existingUnpaidBill.items.map(item => {
            return {
                ...item,
                cost: item.cost ?? 0,
                quantity: item.quantity || 1,
            };
        });
        setItems(itemsWithCost);
      } else {
        setActiveBill(null);
        setItems([]);
      }
    }
    if (onComplete) {
        onComplete();
    }
  }, [students, payments, services]);
  
  // Effect to handle student/service from URL
  useEffect(() => {
    if (!isLoading && studentIdFromUrl && !paymentIdForEdit) {
      loadBillForStudent(studentIdFromUrl, () => {
        const idsToAdd = serviceIdsFromUrl
          ? serviceIdsFromUrl.split(',').map(id => id.trim()).filter(Boolean)
          : serviceIdFromUrl
            ? [serviceIdFromUrl]
            : [];

        const eventIdsToAdd = eventIdsFromUrl
          ? eventIdsFromUrl.split(',').map(id => id.trim()).filter(Boolean)
          : [];
        const importKey = `${studentIdFromUrl}|${idsToAdd.join(',')}|${eventIdsToAdd.join(',')}`;

        if (importedUrlItemsRef.current === importKey) return;

        if (idsToAdd.length > 0 && services) {
          idsToAdd.forEach(serviceId => {
            const serviceToAdd = services.find(s => s.id === serviceId);
            if (serviceToAdd) {
                addServiceToBill(serviceToAdd);
            }
          });
          importedUrlItemsRef.current = importKey;
          router.replace('/app/payments', { scroll: false });
        }

        if (eventIdsToAdd.length > 0 && events && services) {
          const selectedEvents = eventIdsToAdd.flatMap(eventId => {
            const event = events.find(item => item.id === eventId);
            return event ? [event] : [];
          });
          const eventBillItems = createBillItemsFromEvents(selectedEvents);

          if (eventBillItems.length > 0) {
            setItems(prev => [...prev, ...eventBillItems]);
            importedUrlItemsRef.current = importKey;
            router.replace('/app/payments', { scroll: false });
          }
        }
      });
    }
  }, [isLoading, studentIdFromUrl, serviceIdFromUrl, serviceIdsFromUrl, eventIdsFromUrl, services, events, loadBillForStudent, addServiceToBill, createBillItemsFromEvents, paymentIdForEdit, router]);

  const handleSelectStudent = (student: Student | null) => {
    if (paymentIdForEdit) return;

    if (student === null) {
      setSelectedStudent(null);
      setActiveBill(null);
      setItems([]);
      return;
    }
    
    setSelectedStudent(student);
    loadBillForStudent(student.id);
  };

  const handleSelectService = (service: Service) => {
    addServiceToBill(service);
  };

  const handleRemoveItem = (billItemId: string) => {
    setItems(currentItems => currentItems.filter(item => item.billItemId !== billItemId));
  };
  
  const handleItemDateTimeChange = (billItemId: string, newDate: Date) => {
    setItems(currentItems =>
      currentItems.map(item =>
        item.billItemId === billItemId
          ? { ...item, date: newDate.toISOString() }
          : item
      )
    );
  };
  
  const handleItemPriceChange = (billItemId: string, newPrice: number) => {
    setItems(currentItems =>
      currentItems.map(item =>
        item.billItemId === billItemId
          ? { ...item, price: newPrice }
          : item
      )
    );
  };
  
  const handleItemQuantityChange = (billItemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
        handleRemoveItem(billItemId);
        return;
    }
    setItems(currentItems =>
      currentItems.map(item =>
        item.billItemId === billItemId
          ? { ...item, quantity: newQuantity }
          : item
      )
    );
  };

  const handleResetBill = () => {
    setItems([]);
    setActiveBill(null);
    setSelectedStudent(null);
    router.replace('/app/payments');
  };
  
  if (isLoading) {
    return (
        <div className="grid md:grid-cols-3 gap-8 h-full">
            <div className="md:col-span-2">
                <Skeleton className="h-full w-full rounded-lg" />
            </div>
            <div>
                <Skeleton className="h-full w-full rounded-lg" />
            </div>
        </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col gap-4 pb-24 md:pb-0 h-[calc(100vh-168px)] md:h-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-2 md:pb-0 md:static">
            <StudentSelector 
                students={sortedStudents}
                selectedStudent={selectedStudent}
                onSelectStudent={handleSelectStudent}
                isEditing={!!paymentIdForEdit}
            />
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-2xl border bg-card p-2 text-center shadow-sm sm:hidden">
            <div className="rounded-xl bg-muted/60 px-2 py-2">
                <p className="text-[11px] font-medium text-muted-foreground">Customer</p>
                <p className="truncate text-sm font-semibold">{selectedStudent?.name || 'Walk-in'}</p>
            </div>
            <div className="rounded-xl bg-muted/60 px-2 py-2">
                <p className="text-[11px] font-medium text-muted-foreground">Items</p>
                <p className="text-sm font-semibold">{items.length}</p>
            </div>
            <div className="rounded-xl bg-[#F4C430]/15 px-2 py-2 text-[#7A5A00]">
                <p className="text-[11px] font-medium">Total</p>
                <p className="truncate text-sm font-bold">{formatCurrency(currentSubtotal)}</p>
            </div>
        </div>
        
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_390px] md:flex-1 md:overflow-hidden">
            <div className="overflow-y-auto">
                <ServiceSelection onSelectService={handleSelectService} />
            </div>
            
            {/* Desktop View Current Bill */}
            <div className="hidden md:block md:h-full">
                <CurrentBill 
                    billItems={items} 
                    activeBill={activeBill}
                    selectedStudent={selectedStudent}
                    onReset={handleResetBill}
                    onRemoveItem={handleRemoveItem}
                    onItemDateTimeChange={handleItemDateTimeChange}
                    onItemPriceChange={handleItemPriceChange}
                    onItemQuantityChange={handleItemQuantityChange}
                    isEditing={!!paymentIdForEdit}
                />
            </div>
        </div>

        {/* Mobile Sticky Cart Banner */}
        <div className="md:hidden fixed bottom-16 left-0 right-0 p-4 bg-background border-t shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] z-30">
            <Sheet open={isMobileCartOpen} onOpenChange={setIsMobileCartOpen}>
                <SheetTrigger asChild>
                    <Button className="h-14 w-full justify-between rounded-2xl bg-[#111827] px-4 text-base font-bold text-white shadow-xl hover:bg-[#1F2937]">
                        <div className="flex items-center gap-2">
                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
                                <ShoppingCart className="h-5 w-5" />
                            </span>
                            <span>Bill</span>
                        </div>
                        <span className="flex items-center gap-2 rounded-xl bg-[#F4C430] px-3 py-2 text-[#0D1B2A]">
                            <BadgeDollarSign className="h-4 w-4" />
                            {formatCurrency(currentSubtotal)}
                        </span>
                    </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="flex h-[88vh] flex-col rounded-t-[2rem] p-0">
                    <SheetHeader className="shrink-0 border-b px-6 py-4 text-left">
                        <SheetTitle className="text-xl">Current Bill</SheetTitle>
                    </SheetHeader>
                    <div className="min-h-0 flex-1 overflow-hidden p-3">
                        <CurrentBill 
                            billItems={items} 
                            activeBill={activeBill}
                            selectedStudent={selectedStudent}
                            onReset={() => {
                                handleResetBill();
                                setIsMobileCartOpen(false);
                            }}
                            onRemoveItem={handleRemoveItem}
                            onItemDateTimeChange={handleItemDateTimeChange}
                            onItemPriceChange={handleItemPriceChange}
                            onItemQuantityChange={handleItemQuantityChange}
                            isEditing={!!paymentIdForEdit}
                        />
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    </div>
  );
}
