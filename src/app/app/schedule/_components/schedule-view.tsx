'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addMonths,
  subMonths,
  format,
  addDays,
  subDays,
  addWeeks,
  subWeeks,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  addMinutes,
} from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, ChevronRight, Loader2, Plus } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CalendarEvent, InstructorOption, LessonStatus, PaymentMethod } from '@/lib/types';
import { EventDialog } from './event-dialog';
import { useEvents } from '@/hooks/use-events';
import { usePayments } from '@/hooks/use-payments';
import { useServices } from '@/hooks/use-services';
import { useStudents } from '@/hooks/use-students';
import { useWhatsAppLogs } from '@/hooks/use-whatsapp-logs';
import { MonthView } from './month-view';
import { WeekView } from './week-view';
import { DayView } from './day-view';
import { EventDetailsDialog } from './event-details-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ExamSchedulerDialog } from './exam-scheduler-dialog';
import { ListView } from './list-view';
import { useGoogleCalendar } from '@/hooks/use-google-calendar';
import { CalendarDays, Car, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { getAuthenticatedHeaders } from '@/lib/authenticated-fetch';
import { createPaymentTransaction, getStudentAdvanceCredit } from '@/lib/payment-utils';
import { roundCurrency } from '@/lib/tax';
import { MissingPhoneDialog } from '@/app/app/_components/missing-phone-dialog';
import { Student } from '@/lib/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { collection, query, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useSession } from '@/firebase';
import type { TenantMember } from '@/lib/auth-config';
type ViewMode = 'month' | 'week' | 'day' | 'list';
const PENDING_GOOGLE_SYNC_KEY = 'sparkon_google_calendar_pending_sync';
const GOOGLE_TIMEZONE_FIX_SYNC_KEY = 'sparkon_google_calendar_timezone_fix_v1';
const viewModes: ViewMode[] = ['day', 'week', 'month', 'list'];
const BUSINESS_TIME_ZONE = 'America/Toronto';
const TRAVEL_WARNING_MINUTES = 10;
const SPARKON_GOOGLE_EVENT_ID_PROPERTY = 'sparkonEventId';
const SPARKON_GOOGLE_DESCRIPTION_MARKER = 'Synced from InstructorOS.';

const clearScheduleInteractionLock = () => {
  if (typeof document === 'undefined') return;

  document.body.style.removeProperty('pointer-events');
  document.body.style.removeProperty('overflow');
  document.body.style.removeProperty('padding-right');
  document.documentElement.style.removeProperty('pointer-events');
  document.body.removeAttribute('data-scroll-locked');
};

const releaseScheduleInteractionLockSoon = () => {
  if (typeof window === 'undefined') return;
  [0, 80, 250, 600].forEach(delay => window.setTimeout(clearScheduleInteractionLock, delay));
};

const toGoogleLocalDateTime = (dateValue: string) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(dateValue));
  const value = (type: string) => parts.find(part => part.type === type)?.value || '00';
  return `${value('year')}-${value('month')}-${value('day')}T${value('hour')}:${value('minute')}:${value('second')}`;
};

export function ScheduleView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewMode>('day');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInstructorId, setSelectedInstructorId] = useState('all');

  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isExamDialogOpen, setIsExamDialogOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isMobileCalendarOpen, setIsMobileCalendarOpen] = useState(false);

  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [conflictData, setConflictData] = useState<{
    eventData: Omit<CalendarEvent, 'id'> | CalendarEvent;
    sendSms: boolean;
    overlapList: string[];
    travelWarnings: string[];
  } | null>(null);
  const [selectedDateTime, setSelectedDateTime] = useState<Date | null>(null);
  const [isSyncingGoogle, setIsSyncingGoogle] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const examStudentId = searchParams.get('examStudentId') || undefined;
  const eventIdParam = searchParams.get('eventId');
  const [examStudentIdForDialog, setExamStudentIdForDialog] = useState<string | undefined>(undefined);
  const [missingPhoneStudent, setMissingPhoneStudent] = useState<Student | null>(null);
  const [pendingSmsData, setPendingSmsData] = useState<{ finalData: Omit<CalendarEvent, 'id'> | CalendarEvent, isUpdate: boolean } | null>(null);

  const [isOptimizerDialogOpen, setIsOptimizerDialogOpen] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState<any>(null);
  const [eventsToOptimize, setEventsToOptimize] = useState<CalendarEvent[]>([]);

  const firestore = useFirestore();
  const { activeTenantId, canManageTenant, tenant, user } = useSession();
  const { events: allEvents, loading: isEventsLoading, addEvent, updateEvent: updateEventFirestore, deleteEvent: deleteEventFirestore } = useEvents();
  const { students: allStudents, updateStudent } = useStudents();
  const { payments, addPayment, updatePayment, getPaymentById, loading: paymentsLoading } = usePayments();
  const { services: allServices, loading: servicesLoading } = useServices();
  const {
    connect,
    isConnected,
    isConfigured: isGoogleConfigured,
    connectionError: googleConnectionError,
    isClientLoaded,
    fetchEvents: fetchGEvents,
    createEvent: createGEvent,
    updateEvent: updateGEvent,
    deleteEvent: deleteGEvent,
    findEvent: findGEvent,
  } = useGoogleCalendar();
  const { toast } = useToast();
  const { sendAndLogWhatsApp } = useWhatsAppLogs();

  const membersQuery = useMemoFirebase(
    () => (firestore && activeTenantId && canManageTenant
      ? query(collection(firestore, 'tenants', activeTenantId, 'members'), where('status', '==', 'active'))
      : null),
    [firestore, activeTenantId, canManageTenant]
  );
  const { data: activeMembers } = useCollection<TenantMember>(membersQuery);

  const instructorOptions = useMemo<InstructorOption[]>(() => {
    const members: InstructorOption[] = (activeMembers || [])
      .filter(member => member.role === 'schoolInstructor' || member.role === 'schoolAdmin' || member.role === 'soloInstructor')
      .map(member => ({
        uid: member.uid,
        displayName: member.displayName,
        email: member.email,
        role: member.role,
      }));

    if (user && !members.some(member => member.uid === user.uid)) {
      members.unshift({
        uid: user.uid,
        displayName: user.displayName || undefined,
        email: user.email || undefined,
        role: 'currentUser',
      });
    }

    return members.sort((a, b) => (a.displayName || a.email || '').localeCompare(b.displayName || b.email || ''));
  }, [activeMembers, user]);

  const instructorNameById = useMemo(() => {
    return instructorOptions.reduce<Record<string, string>>((acc, instructor) => {
      acc[instructor.uid] = instructor.displayName || instructor.email || 'Instructor';
      return acc;
    }, {});
  }, [instructorOptions]);

  const mobileWeekDays = useMemo(() => {
    return eachDayOfInterval({
      start: startOfWeek(currentDate),
      end: endOfWeek(currentDate),
    });
  }, [currentDate]);

  const mobileEventCountByDay = useMemo(() => {
    const map = new Map<string, number>();
    allEvents.forEach(event => {
      if (selectedInstructorId !== 'all' && event.instructorId !== selectedInstructorId) return;

      const key = format(new Date(event.start), 'yyyy-MM-dd');
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [allEvents, selectedInstructorId]);

  useEffect(() => {
    if (!canManageTenant && selectedInstructorId !== 'all') {
      setSelectedInstructorId('all');
      return;
    }

    if (selectedInstructorId !== 'all' && !instructorNameById[selectedInstructorId]) {
      setSelectedInstructorId('all');
    }
  }, [canManageTenant, instructorNameById, selectedInstructorId]);

  const toGoogleEvent = useCallback((eventData: Omit<CalendarEvent, 'id'> | CalendarEvent) => {
    const services = eventData.services?.map(service => service.name).join(', ');
    const descriptionParts = [
      eventData.studentName && eventData.studentName !== 'N/A' ? `Student: ${eventData.studentName}` : '',
      services ? `Services: ${services}` : '',
      'lessonStatus' in eventData && eventData.lessonStatus && eventData.lessonStatus !== 'scheduled'
        ? `Lesson status: ${eventData.lessonStatus}`
        : '',
      eventData.notes || '',
      SPARKON_GOOGLE_DESCRIPTION_MARKER,
    ].filter(Boolean);
    const sparkonEventId = 'id' in eventData ? eventData.id : undefined;

    return {
      summary: eventData.title,
      description: descriptionParts.join('\n'),
      location: eventData.studentAddress || undefined,
      start: { dateTime: toGoogleLocalDateTime(eventData.start), timeZone: BUSINESS_TIME_ZONE },
      end: { dateTime: toGoogleLocalDateTime(eventData.end), timeZone: BUSINESS_TIME_ZONE },
      extendedProperties: sparkonEventId
        ? { private: { [SPARKON_GOOGLE_EVENT_ID_PROPERTY]: sparkonEventId } }
        : undefined,
    };
  }, []);

  const googleDateTimeMinute = (dateTime?: string) => dateTime?.slice(0, 16) || '';
  const getUserGoogleEventId = useCallback((event?: Partial<CalendarEvent> | null) => {
    if (!event) return undefined;
    return (user?.uid ? event.googleEventIds?.[user.uid] : undefined) || event.googleEventId;
  }, [user?.uid]);

  const buildGoogleEventIdUpdate = useCallback((eventId: string, googleEventId: string) => {
    return user?.uid
      ? ({ id: eventId, [`googleEventIds.${user.uid}`]: googleEventId } as Partial<CalendarEvent> & { id: string })
      : ({ id: eventId, googleEventId } as Partial<CalendarEvent> & { id: string });
  }, [user?.uid]);

  const withUserGoogleEventId = useCallback((event: CalendarEvent, googleEventId: string) => {
    return user?.uid
      ? { ...event, googleEventIds: { ...(event.googleEventIds || {}), [user.uid]: googleEventId } }
      : { ...event, googleEventId };
  }, [user?.uid]);

  const googleEventMatchesLocalEvent = useCallback((
    googleEvent: { id?: string; summary?: string; description?: string; start?: { dateTime?: string }; end?: { dateTime?: string }; extendedProperties?: { private?: Record<string, string> } },
    localEvent: CalendarEvent
  ) => {
    if (googleEvent.id && getUserGoogleEventId(localEvent) === googleEvent.id) return true;

    const googleSparkonEventId = googleEvent.extendedProperties?.private?.[SPARKON_GOOGLE_EVENT_ID_PROPERTY];
    const localGoogleEvent = toGoogleEvent(localEvent);
    const timeMatches = googleDateTimeMinute(googleEvent.start?.dateTime) === googleDateTimeMinute(localGoogleEvent.start.dateTime)
      && googleDateTimeMinute(googleEvent.end?.dateTime) === googleDateTimeMinute(localGoogleEvent.end.dateTime);

    if (googleSparkonEventId) {
      return googleSparkonEventId === localEvent.id && timeMatches;
    }

    return googleEvent.description?.includes(SPARKON_GOOGLE_DESCRIPTION_MARKER)
      && googleEvent.summary === localGoogleEvent.summary
      && timeMatches;
  }, [getUserGoogleEventId, toGoogleEvent]);

  const cleanupOrphanedGoogleEvents = useCallback(async (localEvents: CalendarEvent[]) => {
    if (!isConnected) return;

    const googleEvents = await fetchGEvents();
    for (const googleEvent of googleEvents) {
      if (!googleEvent.id || googleEvent.status === 'cancelled') continue;

      const isSparkonEvent = googleEvent.description?.includes(SPARKON_GOOGLE_DESCRIPTION_MARKER)
        || Boolean(googleEvent.extendedProperties?.private?.[SPARKON_GOOGLE_EVENT_ID_PROPERTY]);
      if (!isSparkonEvent) continue;

      const hasLocalMatch = localEvents.some(localEvent => googleEventMatchesLocalEvent(googleEvent, localEvent));
      if (!hasLocalMatch) {
        await deleteGEvent(googleEvent.id);
      }
    }
  }, [deleteGEvent, fetchGEvents, googleEventMatchesLocalEvent, isConnected]);

  const syncGoogleEventAfterLocalSave = useCallback(async (
    savedEventId: string | undefined,
    eventData: Omit<CalendarEvent, 'id'> | CalendarEvent,
    previousEvent?: CalendarEvent,
    localEventsAfterSave?: CalendarEvent[]
  ) => {
    if (!isConnected || !savedEventId) return;

    const eventWithId = { ...eventData, id: savedEventId } as CalendarEvent;
    const googleEvent = toGoogleEvent(eventWithId);
    const existingGoogleEventId = getUserGoogleEventId('id' in eventData ? eventData : previousEvent) || getUserGoogleEventId(previousEvent);

    if (existingGoogleEventId) {
      const updated = await updateGEvent(existingGoogleEventId, googleEvent);
      if (updated && getUserGoogleEventId(eventData) !== existingGoogleEventId) {
        await updateEventFirestore(buildGoogleEventIdUpdate(savedEventId, existingGoogleEventId));
      }
      if (updated && localEventsAfterSave) {
        await cleanupOrphanedGoogleEvents(
          localEventsAfterSave.map(localEvent => (
            localEvent.id === savedEventId
              ? withUserGoogleEventId(localEvent, existingGoogleEventId)
              : localEvent
          ))
        );
      }
      return;
    }

    const matchedGoogleEventId = await findGEvent(savedEventId, previousEvent ? toGoogleEvent(previousEvent) : undefined);
    if (matchedGoogleEventId) {
      const updated = await updateGEvent(matchedGoogleEventId, googleEvent);
      if (updated) {
        await updateEventFirestore(buildGoogleEventIdUpdate(savedEventId, matchedGoogleEventId));
        if (localEventsAfterSave) {
          await cleanupOrphanedGoogleEvents(
            localEventsAfterSave.map(localEvent => (
              localEvent.id === savedEventId
                ? withUserGoogleEventId(localEvent, matchedGoogleEventId)
                : localEvent
            ))
          );
        }
      }
      return;
    }

    const googleEventId = await createGEvent(googleEvent);
    if (googleEventId) {
      await updateEventFirestore(buildGoogleEventIdUpdate(savedEventId, googleEventId));
      if (localEventsAfterSave) {
        await cleanupOrphanedGoogleEvents(
          localEventsAfterSave.map(localEvent => (
            localEvent.id === savedEventId
              ? withUserGoogleEventId(localEvent, googleEventId)
              : localEvent
          ))
        );
      }
    }
  }, [buildGoogleEventIdUpdate, cleanupOrphanedGoogleEvents, createGEvent, findGEvent, getUserGoogleEventId, isConnected, toGoogleEvent, updateEventFirestore, updateGEvent, withUserGoogleEventId]);

  const isScheduleOverlayOpen = isFormDialogOpen
    || isDetailsDialogOpen
    || isExamDialogOpen
    || isCalendarOpen
    || Boolean(conflictData)
    || Boolean(missingPhoneStudent);

  useEffect(() => {
    if (!isScheduleOverlayOpen) {
      releaseScheduleInteractionLockSoon();
    }
  }, [isScheduleOverlayOpen]);

  const handlePrev = () => {
    if (view === 'month') setCurrentDate(subMonths(currentDate, 1));
    if (view === 'week') setCurrentDate(subWeeks(currentDate, 1));
    if (view === 'day' || view === 'list') setCurrentDate(subDays(currentDate, 1));
  };

  const handleNext = () => {
    if (view === 'month') setCurrentDate(addMonths(currentDate, 1));
    if (view === 'week') setCurrentDate(addWeeks(currentDate, 1));
    if (view === 'day' || view === 'list') setCurrentDate(addDays(currentDate, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  }

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsDetailsDialogOpen(true);
  };

  const handleEvaluate = (event: CalendarEvent) => {
    if (!event.studentId) return;
    setIsDetailsDialogOpen(false);
    router.push(`/app/evaluations?lessonId=${encodeURIComponent(event.id)}`);
  };

  const handleSlotClick = (date: Date) => {
    setSelectedEvent(null);
    setSelectedDateTime(date);
    setIsFormDialogOpen(true);
  }

  const handleAddNewClick = () => {
    setSelectedEvent(null);
    setSelectedDateTime(new Date(currentDate));
    setIsFormDialogOpen(true);
  }

  const matchesSelectedInstructor = (event: CalendarEvent) => {
    return selectedInstructorId === 'all' || event.instructorId === selectedInstructorId;
  };

  const handleOptimizeRoute = async () => {
    if (canManageTenant && selectedInstructorId === 'all' && instructorOptions.length > 1) {
      toast({
        title: 'Choose one instructor',
        description: 'Select an instructor before optimizing a route so each instructor keeps their own driving order.',
      });
      return;
    }

    // Only optimize events for the currently viewed date that have an address
    const targetDateStr = currentDate.toDateString();
    const dayEvents = (allEvents || [])
      .filter(e => matchesSelectedInstructor(e) && new Date(e.start).toDateString() === targetDateStr && e.studentAddress && e.studentAddress !== '')
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    if (dayEvents.length < 2) {
      toast({
        title: 'Not enough events',
        description: 'You need at least 2 events with valid addresses on this day to optimize the route.',
      });
      return;
    }

    setEventsToOptimize(dayEvents);
    setIsOptimizerDialogOpen(true);
    setIsOptimizing(true);
    setOptimizationResult(null);

    try {
      const response = await fetch('/api/optimize-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getAuthenticatedHeaders()) },
        body: JSON.stringify({
          events: dayEvents.map(e => ({
            id: e.id,
            studentName: e.studentName,
            address: e.studentAddress,
            originalStart: e.start,
            originalEnd: e.end,
            durationMinutes: Math.round((new Date(e.end).getTime() - new Date(e.start).getTime()) / 60000)
          }))
        })
      });

      const result = await response.json();
      if (result.ok) {
        setOptimizationResult(result.details);
      } else {
        toast({ title: 'Optimization failed', description: result.error, variant: 'destructive' });
        setIsOptimizerDialogOpen(false);
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to contact AI optimizer.', variant: 'destructive' });
      setIsOptimizerDialogOpen(false);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleApplyOptimization = async () => {
    if (!optimizationResult || !optimizationResult.optimizedOrder) return;
    
    // Update the events in Firestore
    for (const opt of optimizationResult.optimizedOrder) {
      const originalEvent = eventsToOptimize.find(e => e.id === opt.eventId);
      if (originalEvent) {
        await updateEventFirestore({
          id: originalEvent.id,
          start: opt.suggestedStartTime,
          end: opt.suggestedEndTime
        });
      }
    }
    
    setIsOptimizerDialogOpen(false);
    toast({ title: 'Schedule Updated', description: 'The optimized route has been applied to your calendar.' });
  };

  useEffect(() => {
    if (!examStudentId) return;
    setSelectedEvent(null);
    setExamStudentIdForDialog(examStudentId);
    setIsDetailsDialogOpen(false);
    setIsFormDialogOpen(false);
    setIsExamDialogOpen(true);
    router.replace('/app/schedule', { scroll: false });
  }, [examStudentId, router]);

  const handleEditClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsDetailsDialogOpen(false);
    // Delay opening the form dialog to allow the details dialog to unmount cleanly
    setTimeout(() => {
      setIsFormDialogOpen(true);
    }, 150);
  }

  // Scheduling a lesson shares the student with that lesson's instructor:
  // assigned instructors get full student details through the secure server
  // routes, so the school admin never has to assign students by hand.
  const ensureStudentAssignedToInstructor = async (studentId?: string | null, instructorId?: string | null) => {
    if (tenant?.type !== 'school' || !studentId || !instructorId) return;
    const student = allStudents?.find(item => item.id === studentId);
    if (!student || student.assignedInstructorIds?.includes(instructorId)) return;
    try {
      await updateStudent({
        id: studentId,
        assignedInstructorIds: [...(student.assignedInstructorIds || []), instructorId],
      });
    } catch {
      // Non-fatal: the lesson still saves, and assignment retries on the next scheduling.
    }
  };

  const handleBookNext = async (event: CalendarEvent) => {
    const currentStart = new Date(event.start);
    const currentEnd = new Date(event.end);
    const nextStart = addDays(currentStart, 1);
    const nextEnd = addDays(currentEnd, 1);

    const nextEventData: Omit<CalendarEvent, 'id'> = {
      title: event.title,
      start: nextStart.toISOString(),
      end: nextEnd.toISOString(),
      instructorId: event.instructorId || user?.uid || null,
      studentId: event.studentId,
      studentName: event.studentName,
      studentAddress: event.studentAddress,
      services: event.services || [],
      notes: event.notes,
    };

    const finalData = { ...nextEventData };

    const docRef = await addEvent(finalData);
    void ensureStudentAssignedToInstructor(finalData.studentId, finalData.instructorId);
    const savedEventId = docRef?.id;
    const newEvent = { ...finalData, id: savedEventId || `new-${Date.now()}` };

    if (savedEventId) {
      void syncGoogleEventAfterLocalSave(savedEventId, newEvent, undefined, [...allEvents, newEvent]);
    }

    setCurrentDate(nextStart);
    setSelectedEvent(newEvent);
    setSelectedDateTime(nextStart);
    setIsDetailsDialogOpen(false);
    setTimeout(() => {
      setIsFormDialogOpen(true);
    }, 150);

    toast({
      title: 'Next lesson booked',
      description: 'I opened the new appointment so you can edit it.',
    });
  };

  const handleMarkPayment = async (event: CalendarEvent, status: 'paid' | 'unpaid') => {
    if (paymentsLoading || servicesLoading) {
      toast({
        title: 'Still loading',
        description: 'Please try again in a moment.',
      });
      return;
    }

    if (!event.studentId || !event.services?.length) {
      toast({
        variant: 'destructive',
        title: 'Add a student and service first',
        description: 'Payments need a student and at least one service.',
      });
      return;
    }

    // Reuse a bill saved from POS for this lesson even when the event link is
    // missing (older bills) — prevents a duplicate payment doc for one lesson.
    const linkedPayment = event.paymentId ? getPaymentById(event.paymentId) : null;
    const existingPayment = linkedPayment
      || (payments || []).find(p => p.status === 'unpaid' && p.studentId === event.studentId && p.items?.some(item => item.eventId === event.id))
      || null;
    const items = existingPayment?.items?.length ? existingPayment.items : event.services.map(service => {
      const serviceDetails = allServices.find(item => item.id === service.id || item.name === service.name);
      const basePrice = service.price ?? serviceDetails?.price ?? 0;
      const discount = service.discount ?? serviceDetails?.discount ?? 0;
      const price = basePrice - discount;

      return {
        id: service.id,
        name: service.name,
        price,
        cost: service.cost ?? serviceDetails?.cost ?? 0,
        billItemId: `${event.id}-${service.id}`,
        date: event.start,
        quantity: 1,
        eventId: event.id,
        ...(serviceDetails?.packageItems?.length ? { packageItems: serviceDetails.packageItems.map(c => ({ ...c })) } : {}),
      };
    });

    const subtotal = existingPayment?.subtotal ?? roundCurrency(items.reduce((sum, item) => sum + item.price * item.quantity, 0));
    const discount = existingPayment?.discount ?? 0;
    const tax = existingPayment?.tax ?? 0;
    const total = existingPayment?.total ?? roundCurrency(subtotal);
    const totalCost = existingPayment?.totalCost ?? roundCurrency(items.reduce((sum, item) => sum + (item.cost || 0) * item.quantity, 0));
    const isPaid = status === 'paid';
    // Cash payments are collected without HST (business practice), so this
    // quick-mark flow intentionally records no tax on new payments.
    const availableCredit = isPaid && !existingPayment ? getStudentAdvanceCredit(payments, event.studentId) : 0;
    const creditApplied = existingPayment ? (existingPayment.creditApplied || 0) : Math.min(availableCredit, total);
    const cashCollected = isPaid ? Math.max(0, total - (existingPayment ? 0 : creditApplied)) : 0;
    const paymentMethod: PaymentMethod = isPaid
      ? (!existingPayment && cashCollected <= 0 && creditApplied > 0 ? 'Advance' : 'Cash')
      : 'Unpaid';

    const paymentData = {
      studentId: event.studentId,
      studentName: event.studentName,
      items,
      subtotal,
      discount,
      tax,
      total,
      totalCost,
      paidAmount: isPaid ? total : 0,
      amountDue: isPaid ? 0 : total,
      paymentMethod,
      paymentDate: existingPayment?.paymentDate || new Date().toISOString(),
      status,
      notes: event.notes ? `From schedule: ${event.notes}` : 'From schedule.',
      instructorId: event.instructorId || user?.uid || null,
      creditApplied,
      transactions: [
        ...(existingPayment?.transactions || []),
        ...(!existingPayment && isPaid && creditApplied > 0
          ? [createPaymentTransaction('credit-applied', creditApplied, 'Advance', 'Student advance credit applied to this lesson.')]
          : []),
        ...(isPaid && (existingPayment || cashCollected > 0)
          ? [createPaymentTransaction('payment', existingPayment ? total : cashCollected, paymentMethod, 'Payment marked from schedule.')]
          : []),
        ...(!isPaid
          ? [createPaymentTransaction('adjustment', -(existingPayment?.paidAmount || 0), paymentMethod, 'Marked unpaid from schedule.')]
          : []),
      ],
    };

    let paymentId = existingPayment?.id || event.paymentId;

    if (existingPayment) {
      await updatePayment({ ...paymentData, id: existingPayment.id });
    } else {
      const paymentRef = await addPayment(paymentData);
      paymentId = paymentRef?.id || paymentId;
    }

    const eventUpdates = {
      id: event.id,
      paymentId,
      paymentStatus: status,
      paymentMethod,
    };

    await updateEventFirestore(eventUpdates);
    setSelectedEvent({ ...event, ...eventUpdates });

    toast({
      title: isPaid ? 'Marked cash paid' : 'Marked unpaid',
      description: 'This is now connected to Payment History.',
    });
  };

  const handleMarkLessonStatus = async (event: CalendarEvent, status: LessonStatus) => {
    const updates = {
      id: event.id,
      lessonStatus: status,
    };

    await updateEventFirestore(updates);
    const updatedEvent = { ...event, ...updates };
    setSelectedEvent(updatedEvent);

    if (isConnected) {
      const localEventsAfterStatusChange = allEvents.map(localEvent => (
        localEvent.id === event.id ? updatedEvent : localEvent
      ));
      void syncGoogleEventAfterLocalSave(event.id, updatedEvent, event, localEventsAfterStatusChange);
    }

    toast({
      title: status === 'scheduled' ? 'Lesson marked scheduled' : status === 'no-show' ? 'Marked no show' : 'Lesson cancelled',
      description: 'The schedule has been updated.',
    });
  };

  const getActiveComparableEvents = (eventData: Omit<CalendarEvent, 'id'> | CalendarEvent) => {
    const eventId = 'id' in eventData ? eventData.id : null;
    const instructorId = eventData.instructorId || null;
    return allEvents
      .filter(event => event.id !== eventId)
      .filter(event => (event.instructorId || null) === instructorId)
      .filter(event => (event.lessonStatus || 'scheduled') !== 'cancelled');
  };

  const checkScheduleOverlap = (eventData: Omit<CalendarEvent, 'id'> | CalendarEvent) => {
    const start = new Date(eventData.start);
    const end = new Date(eventData.end);
    return getActiveComparableEvents(eventData).filter(event => {
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);
      return start < eventEnd && end > eventStart;
    });
  };

  const estimateTravelMinutes = async (origin: string, destination: string) => {
    try {
      const response = await fetch('/api/travel-time', {
        method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(await getAuthenticatedHeaders()) },
        body: JSON.stringify({ origin, destination }),
      });
      const result = await response.json();
      return result.ok && result.details?.travelTimeMinutes ? Number(result.details.travelTimeMinutes) : null;
    } catch {
      return null;
    }
  };

  const checkTravelSpacing = async (eventData: Omit<CalendarEvent, 'id'> | CalendarEvent) => {
    if (!eventData.studentId || !eventData.studentAddress) return [];

    const start = new Date(eventData.start);
    const end = new Date(eventData.end);
    const sameDayStudentEvents = getActiveComparableEvents(eventData)
      .filter(event => event.studentId && event.studentAddress)
      .filter(event => new Date(event.start).toDateString() === start.toDateString())
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    const previousEvent = [...sameDayStudentEvents].reverse().find(event => new Date(event.end) <= start);
    const nextEvent = sameDayStudentEvents.find(event => new Date(event.start) >= end);
    const warnings: string[] = [];

    if (previousEvent?.studentAddress) {
      const travelMinutes = await estimateTravelMinutes(previousEvent.studentAddress, eventData.studentAddress);
      if (travelMinutes !== null) {
        const gapMinutes = Math.round((start.getTime() - new Date(previousEvent.end).getTime()) / 60000);
        if (travelMinutes > TRAVEL_WARNING_MINUTES || travelMinutes > gapMinutes) {
          warnings.push(
            `${previousEvent.studentName} to ${eventData.studentName}: about ${travelMinutes} min drive, with ${gapMinutes} min gap.`
          );
        }
      }
    }

    if (nextEvent?.studentAddress) {
      const travelMinutes = await estimateTravelMinutes(eventData.studentAddress, nextEvent.studentAddress);
      if (travelMinutes !== null) {
        const gapMinutes = Math.round((new Date(nextEvent.start).getTime() - end.getTime()) / 60000);
        if (travelMinutes > TRAVEL_WARNING_MINUTES || travelMinutes > gapMinutes) {
          warnings.push(
            `${eventData.studentName} to ${nextEvent.studentName}: about ${travelMinutes} min drive, with ${gapMinutes} min gap.`
          );
        }
      }
    }

    return warnings;
  };

  const checkScheduleConflicts = async (eventData: Omit<CalendarEvent, 'id'> | CalendarEvent) => {
    const overlapEvents = checkScheduleOverlap(eventData);
    const overlapList = overlapEvents
      .slice(0, 3)
      .map(event => `${event.studentName}: ${format(new Date(event.start), 'h:mm a')} - ${format(new Date(event.end), 'h:mm a')}`);

    const travelWarnings = await checkTravelSpacing(eventData);

    return { overlapList, travelWarnings };
  };

  const buildScheduleSmsMessage = (eventData: Omit<CalendarEvent, 'id'> | CalendarEvent, isUpdate: boolean) => {
    const services = eventData.services?.map(service => service.name).filter(Boolean).join(', ');
    const start = new Date(eventData.start);
    const end = new Date(eventData.end);
    const date = format(start, 'EEE, MMM d');
    const time = `${format(start, 'h:mm a')} - ${format(end, 'h:mm a')}`;
    const action = isUpdate ? 'updated' : 'scheduled';

    return [
      `Hi ${eventData.studentName},\n\nYour driving lesson has been ${action} for ${date} from ${time}.`,
      services ? `Service: ${services}` : '',
      eventData.studentAddress ? `Pickup: ${eventData.studentAddress}` : '',
      `Thanks,\n${tenant?.messageSenderName || tenant?.receiptBusinessName || tenant?.name || 'Your driving instructor'}`
    ].filter(Boolean).join('\n\n');
  };

  const buildScheduleWhatsappVariables = (eventData: Omit<CalendarEvent, 'id'> | CalendarEvent, isUpdate: boolean) => {
    const services = eventData.services?.map(service => service.name).filter(Boolean).join(', ') || 'Driving lesson';
    const start = new Date(eventData.start);
    const end = new Date(eventData.end);

    return {
      1: eventData.studentName,
      2: isUpdate ? 'updated' : 'scheduled',
      3: format(start, 'EEE, MMM d'),
      4: `${format(start, 'h:mm a')} - ${format(end, 'h:mm a')}`,
      5: services,
      6: eventData.studentAddress || 'your pickup address on file',
    };
  };

  const handleSendWhatsAppEvent = (eventData: CalendarEvent) => {
    if (!eventData.studentId || eventData.studentName === 'N/A') return;
    const student = allStudents?.find(item => item.id === eventData.studentId);
    if (!student || !student.mobileNumber) {
      toast({ variant: 'destructive', title: 'Error', description: 'Student missing mobile number.' });
      return;
    }
    const message = buildScheduleSmsMessage(eventData, false);
    const cleanedNumber = student.mobileNumber.replace(/\D/g, '');
    const url = `https://api.whatsapp.com/send?phone=1${cleanedNumber}&text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const sendScheduleSms = async (eventData: Omit<CalendarEvent, 'id'> | CalendarEvent, isUpdate: boolean) => {
    if (!eventData.studentId || eventData.studentName === 'N/A') return;

    const student = allStudents?.find(item => item.id === eventData.studentId);
    const mobileNumber = student?.mobileNumber?.trim();
    if (!mobileNumber) return;

    const body = buildScheduleSmsMessage(eventData, isUpdate);
    const result = await sendAndLogWhatsApp(mobileNumber, body, {
      templateKey: 'schedule',
      variables: buildScheduleWhatsappVariables(eventData, isUpdate),
    });

    if (!result.ok) {
      toast({
        variant: 'destructive',
        title: 'WhatsApp not opened',
        description: result.error || 'Could not open the schedule message.',
      });
      return;
    }

    toast({
      title: 'WhatsApp message opened',
      description: `Schedule message is ready for ${eventData.studentName}.`,
    });
  };

  const handleSaveEvent = async (eventData: Omit<CalendarEvent, 'id'> | CalendarEvent, sendSms: boolean = true) => {
    const eventWithInstructor = {
      ...eventData,
      instructorId: eventData.instructorId || user?.uid || null,
    };
    const { overlapList, travelWarnings } = await checkScheduleConflicts(eventWithInstructor);
    
    if (overlapList.length > 0 || travelWarnings.length > 0) {
      setConflictData({ eventData: eventWithInstructor, sendSms, overlapList, travelWarnings });
      return;
    }

    await performSaveEvent(eventWithInstructor, sendSms);
  };

  const performSaveEvent = async (eventData: Omit<CalendarEvent, 'id'> | CalendarEvent, sendSms: boolean) => {
    setConflictData(null);
    const finalData = { ...eventData };
    const isUpdate = 'id' in finalData;
    let savedEventId = isUpdate ? finalData.id : undefined;
    const previousEvent = isUpdate
      ? allEvents.find(event => event.id === finalData.id) || selectedEvent || undefined
      : undefined;

    if (isUpdate) {
      await updateEventFirestore(finalData as CalendarEvent);
    } else {
      const docRef = await addEvent(finalData);
      savedEventId = docRef?.id;
    }

    const savedEventData = savedEventId
      ? ({ ...finalData, id: savedEventId } as CalendarEvent)
      : finalData;
    const localEventsAfterSave = savedEventId
      ? isUpdate
        ? allEvents.map(event => event.id === savedEventId ? { ...event, ...savedEventData } as CalendarEvent : event)
        : [...allEvents, savedEventData as CalendarEvent]
      : allEvents;

    setIsFormDialogOpen(false);
    setIsExamDialogOpen(false);
    void ensureStudentAssignedToInstructor(finalData.studentId, finalData.instructorId);
    void syncGoogleEventAfterLocalSave(savedEventId, savedEventData, previousEvent, localEventsAfterSave);

    if (sendSms) {
      const student = allStudents?.find(item => item.id === finalData.studentId);
      if (student && !student.mobileNumber?.trim()) {
        setMissingPhoneStudent(student);
        setPendingSmsData({ finalData: savedEventData, isUpdate });
      } else {
        void sendScheduleSms(savedEventData, isUpdate);
      }
    }
  };

  const syncGoogleEvents = useCallback(async () => {
    setIsSyncingGoogle(true);
    try {
      let created = 0;
      let updated = 0;

      for (const event of allEvents) {
        const googleEvent = toGoogleEvent(event);
        const userGoogleEventId = getUserGoogleEventId(event);
        if (userGoogleEventId) {
          const didUpdate = await updateGEvent(userGoogleEventId, googleEvent);
          if (didUpdate) updated += 1;
        } else {
          const matchedGoogleEventId = await findGEvent(event.id, googleEvent);
          if (matchedGoogleEventId) {
            const didUpdate = await updateGEvent(matchedGoogleEventId, googleEvent);
            if (didUpdate) {
              await updateEventFirestore(buildGoogleEventIdUpdate(event.id, matchedGoogleEventId));
              updated += 1;
            }
          } else {
            const googleEventId = await createGEvent(googleEvent);
            if (googleEventId) {
              await updateEventFirestore(buildGoogleEventIdUpdate(event.id, googleEventId));
              created += 1;
            }
          }
        }
      }

      await cleanupOrphanedGoogleEvents(allEvents);

      toast({
        title: "Google Calendar synced",
        description: `${created} added, ${updated} updated. Old duplicates removed.`,
      });
    } finally {
      setIsSyncingGoogle(false);
    }
  }, [
    allEvents,
    buildGoogleEventIdUpdate,
    cleanupOrphanedGoogleEvents,
    createGEvent,
    findGEvent,
    getUserGoogleEventId,
    toGoogleEvent,
    toast,
    updateEventFirestore,
    updateGEvent,
  ]);

  const handleGoogleSync = async () => {
    if (!isConnected) {
      window.sessionStorage.setItem(PENDING_GOOGLE_SYNC_KEY, '1');
      await connect();
      return;
    }

    await syncGoogleEvents();
  };

  useEffect(() => {
    if (!isConnected || isSyncingGoogle || isEventsLoading) return;
    if (window.sessionStorage.getItem(PENDING_GOOGLE_SYNC_KEY) !== '1') return;

    window.sessionStorage.removeItem(PENDING_GOOGLE_SYNC_KEY);
    void syncGoogleEvents();
  }, [isConnected, isEventsLoading, isSyncingGoogle, syncGoogleEvents]);

  useEffect(() => {
    if (!isConnected || isSyncingGoogle || isEventsLoading) return;
    if (window.localStorage.getItem(GOOGLE_TIMEZONE_FIX_SYNC_KEY) === '1') return;

    void (async () => {
      try {
        await syncGoogleEvents();
        window.localStorage.setItem(GOOGLE_TIMEZONE_FIX_SYNC_KEY, '1');
      } catch {
        // Leave the flag unset so the app can retry the calendar repair later.
      }
    })();
  }, [isConnected, isEventsLoading, isSyncingGoogle, syncGoogleEvents]);

  useEffect(() => {
    if (eventIdParam && allEvents.length > 0) {
      const event = allEvents.find(e => e.id === eventIdParam);
      if (event) {
        setSelectedEvent(event);
        setIsDetailsDialogOpen(true);
        router.replace('/app/schedule');
      }
    }
  }, [eventIdParam, allEvents, router]);

  const handleDeleteEvent = async (eventId: string) => {
    const eventToDelete = allEvents.find(event => event.id === eventId) || selectedEvent;
    const googleEventId = getUserGoogleEventId(eventToDelete)
      || (eventToDelete && isConnected ? await findGEvent(eventToDelete.id, toGoogleEvent(eventToDelete)) : null);

    await deleteEventFirestore(eventId);
    setIsDetailsDialogOpen(false);
    setIsFormDialogOpen(false);
    setSelectedEvent(null);

    if (googleEventId && isConnected) {
      await deleteGEvent(googleEventId);
      void cleanupOrphanedGoogleEvents(allEvents.filter(event => event.id !== eventId));
    }
  }

  const handleEventDrop = async (eventId: string, newStart: Date, newEnd: Date) => {
    const event = allEvents.find(event => event.id === eventId);
    const updates = { id: eventId, start: newStart.toISOString(), end: newEnd.toISOString() };

    await updateEventFirestore(updates);

    if (event && isConnected) {
      const updatedEvent = { ...event, ...updates };
      const localEventsAfterDrop = allEvents.map(localEvent => (
        localEvent.id === eventId ? updatedEvent : localEvent
      ));
      void syncGoogleEventAfterLocalSave(eventId, updatedEvent, event, localEventsAfterDrop);
    }
  };




  const renderView = () => {
    switch (view) {
      case 'month':
        return <MonthView currentDate={currentDate} onEventClick={handleEventClick} onDayClick={handleSlotClick} searchQuery={searchQuery} selectedInstructorId={selectedInstructorId} instructorNameById={instructorNameById} />;
      case 'week':
        return <WeekView currentDate={currentDate} onEventClick={handleEventClick} onSlotClick={handleSlotClick} onEventDrop={handleEventDrop} searchQuery={searchQuery} selectedInstructorId={selectedInstructorId} instructorNameById={instructorNameById} />;
      case 'day':
        return <DayView currentDate={currentDate} onEventClick={handleEventClick} onSlotClick={handleSlotClick} onEventDrop={handleEventDrop} searchQuery={searchQuery} selectedInstructorId={selectedInstructorId} instructorNameById={instructorNameById} />;
      case 'list':
        return <ListView currentDate={currentDate} onEventClick={handleEventClick} onEvaluate={handleEvaluate} searchQuery={searchQuery} selectedInstructorId={selectedInstructorId} instructorNameById={instructorNameById} />;
      default:
        return null;
    }
  };

  const headerTitle = () => {
    if (view === 'day' || view === 'list') return format(currentDate, 'MMMM d, yyyy');
    if (view === 'week') {
        const startOfWeekDate = startOfWeek(currentDate);
        const endOfWeekDate = endOfWeek(currentDate);
        const startFormat = format(startOfWeekDate, 'MMM d');
        const endFormat = format(endOfWeekDate, 'MMM d, yyyy');
        return `${startFormat} - ${endFormat}`;
    }
    return format(currentDate, 'MMMM yyyy');
  }

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="sticky top-0 z-20 -mx-4 bg-background/95 px-4 pb-3 pt-2 backdrop-blur md:static md:mx-0 md:bg-transparent md:p-0">
        <div className="rounded-2xl border bg-card p-3 shadow-sm md:rounded-lg md:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Schedule
              </p>
              <h1 className="truncate text-xl font-semibold md:text-2xl">{headerTitle()}</h1>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handleGoogleSync}
                disabled={!isClientLoaded || isSyncingGoogle}
                className={cn(
                  "h-10 w-10 rounded-xl",
                  isConnected && "border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
                  isGoogleConfigured && !isConnected && "border-amber-500 bg-amber-50 text-amber-800 hover:bg-amber-100"
                )}
                aria-label={isConnected ? "Sync Google Calendar" : "Connect Google Calendar"}
                title={googleConnectionError || (isConnected ? "Sync Google Calendar" : "Connect your Google Calendar")}
              >
                {isSyncingGoogle ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOptimizeRoute}
                className="h-10 gap-2 border-primary/20 text-primary hover:bg-primary/5 hidden sm:flex"
              >
                <Sparkles className="h-4 w-4 text-purple-500" />
                <span className="hidden md:inline">Optimize Timing</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsExamDialogOpen(true)}
                className="h-10 gap-2 rounded-xl border-primary/20 text-primary hover:bg-primary/5"
              >
                <Car className="h-4 w-4" />
                <span className="hidden sm:inline">Schedule Exam</span>
              </Button>
              <Button onClick={handleAddNewClick} className="h-10 gap-2 rounded-xl">
                <Plus className="h-4 w-4" />
                <span>Add</span>
              </Button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[auto_1fr_auto] lg:grid-cols-[auto_minmax(13rem,18rem)_1fr_auto] md:items-center">
            <div className="flex items-center justify-between rounded-xl border bg-background p-1 md:w-fit">
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg" onClick={handlePrev} aria-label="Previous date">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" className="h-9 rounded-lg px-4 text-sm font-semibold" onClick={handleToday}>
                Today
              </Button>
              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="hidden h-9 w-9 rounded-lg md:inline-flex">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto rounded-2xl p-0" align="center">
                  <Calendar
                    mode="single"
                    selected={currentDate}
                    onSelect={(date) => {
                      if (date) {
                        setCurrentDate(date);
                        setIsCalendarOpen(false);
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-lg md:hidden"
                onClick={() => setIsMobileCalendarOpen(true)}
                aria-label="Choose date"
              >
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg" onClick={handleNext} aria-label="Next date">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {canManageTenant && instructorOptions.length > 0 && (
              <div className="w-full">
                <Select value={selectedInstructorId} onValueChange={setSelectedInstructorId}>
                  <SelectTrigger className="h-10 bg-background">
                    <SelectValue placeholder="All instructors" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All instructors</SelectItem>
                    {instructorOptions.map(instructor => (
                      <SelectItem key={instructor.uid} value={instructor.uid}>
                        {instructor.displayName || instructor.email || 'Instructor'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="md:px-2 w-full flex">
              <Input
                placeholder="Search schedule by student or instructor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-background h-10 border-border"
              />
            </div>

            <div className="grid grid-cols-4 rounded-lg border bg-muted/40 p-1">
              {viewModes.map(mode => (
                <Button
                  key={mode}
                  type="button"
                  variant="ghost"
                  onClick={() => setView(mode)}
                  className={cn(
                    "h-9 rounded-md px-2 text-xs font-semibold capitalize md:text-sm",
                    view === mode && "bg-background text-foreground shadow-sm"
                  )}
                >
                  {mode}
                </Button>
              ))}
            </div>

            <div className="hidden text-right text-sm text-muted-foreground md:block">
              {isConnected
                ? 'Google connected'
                : isGoogleConfigured
                  ? 'Connect your Google Calendar'
                  : 'Google setup missing'}
            </div>
          </div>

          <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1 md:hidden">
            {mobileWeekDays.map(day => {
              const selected = isSameDay(day, currentDate);
              const eventCount = mobileEventCountByDay.get(format(day, 'yyyy-MM-dd')) || 0;

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => {
                    setCurrentDate(day);
                    setView('day');
                  }}
                  className={cn(
                    "flex min-w-14 flex-col items-center rounded-2xl border px-3 py-2 text-sm transition active:scale-[0.98]",
                    selected
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border bg-background text-foreground"
                  )}
                  aria-pressed={selected}
                >
                  <span className={cn("text-[11px] font-semibold uppercase", selected ? "text-primary-foreground/75" : "text-muted-foreground")}>
                    {format(day, 'EEE')}
                  </span>
                  <span className="mt-1 text-lg font-bold leading-none">{format(day, 'd')}</span>
                  <span className={cn(
                    "mt-1 h-1.5 w-1.5 rounded-full",
                    eventCount > 0 ? (selected ? "bg-primary-foreground" : "bg-primary") : "bg-transparent"
                  )} />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex-1">
        {renderView()}
      </div>

      <Dialog open={isMobileCalendarOpen} onOpenChange={setIsMobileCalendarOpen}>
        <DialogContent className="bottom-0 top-auto max-h-[86vh] translate-y-0 gap-3 rounded-t-3xl border-x-0 border-b-0 p-4 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom sm:hidden">
          <DialogHeader className="pr-8 text-left">
            <DialogTitle>Choose date</DialogTitle>
          </DialogHeader>
          <Calendar
            mode="single"
            selected={currentDate}
            onSelect={(date) => {
              if (date) {
                setCurrentDate(date);
                setView('day');
                setIsMobileCalendarOpen(false);
              }
            }}
            initialFocus
            className="w-full p-0"
            classNames={{
              month: "w-full space-y-4",
              table: "w-full border-collapse",
              head_row: "grid grid-cols-7",
              head_cell: "flex h-9 items-center justify-center rounded-md text-xs font-semibold text-muted-foreground",
              row: "grid grid-cols-7 gap-1 mt-1",
              cell: "relative flex aspect-square items-center justify-center p-0",
              day: "h-full w-full rounded-2xl p-0 text-sm font-semibold",
            }}
          />
        </DialogContent>
      </Dialog>

      <EventDetailsDialog
        isOpen={isDetailsDialogOpen}
        onOpenChange={setIsDetailsDialogOpen}
        event={selectedEvent}
        instructorName={selectedEvent?.instructorId ? instructorNameById[selectedEvent.instructorId] : undefined}
        onEdit={handleEditClick}
        onDelete={handleDeleteEvent}
        onBookNext={handleBookNext}
        onMarkPayment={handleMarkPayment}
        onMarkLessonStatus={handleMarkLessonStatus}
        onSendWhatsApp={handleSendWhatsAppEvent}
        onEvaluate={handleEvaluate}
      />

      <EventDialog
        isOpen={isFormDialogOpen}
        onOpenChange={setIsFormDialogOpen}
        event={selectedEvent}
        selectedDate={selectedDateTime}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
        instructors={instructorOptions}
        canManageInstructorSchedules={canManageTenant}
      />

      <ExamSchedulerDialog
        isOpen={isExamDialogOpen}
        onOpenChange={setIsExamDialogOpen}
        onSave={handleSaveEvent}
        initialStudentId={examStudentIdForDialog}
        initialDate={currentDate}
        instructors={instructorOptions}
        canManageInstructorSchedules={canManageTenant}
      />

      <MissingPhoneDialog
        isOpen={!!missingPhoneStudent}
        student={missingPhoneStudent}
        onCancel={() => {
          setMissingPhoneStudent(null);
          setPendingSmsData(null);
        }}
        onSuccess={async (updatedStudent) => {
          setMissingPhoneStudent(null);
          if (pendingSmsData) {
            // Use the updated mobileNumber because the students list might not be updated yet.
            const body = buildScheduleSmsMessage(pendingSmsData.finalData, pendingSmsData.isUpdate);
            const result = await sendAndLogWhatsApp(updatedStudent.mobileNumber, body, {
              templateKey: 'schedule',
              variables: buildScheduleWhatsappVariables(pendingSmsData.finalData, pendingSmsData.isUpdate),
            });

            if (!result.ok) {
              toast({
                variant: 'destructive',
                title: 'WhatsApp not opened',
                description: result.error || 'Could not open the schedule message.',
              });
            } else {
              toast({
                title: 'WhatsApp message opened',
                description: `Schedule message is ready for ${pendingSmsData.finalData.studentName}.`,
              });
            }

            setPendingSmsData(null);
          }
        }}
      />

      <AlertDialog open={!!conflictData} onOpenChange={(open) => !open && setConflictData(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Schedule Conflict Detected</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                {conflictData?.overlapList && conflictData.overlapList.length > 0 && (
                  <div>
                    <p className="font-medium text-foreground mb-1">This appointment overlaps with:</p>
                    <ul className="list-disc pl-5 space-y-1">
                      {conflictData.overlapList.map((overlap, i) => (
                        <li key={i}>{overlap}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {conflictData?.travelWarnings && conflictData.travelWarnings.length > 0 && (
                  <div>
                    <p className="font-medium text-foreground mb-1">Travel time warning:</p>
                    <ul className="list-disc pl-5 space-y-1">
                      {conflictData.travelWarnings.map((warning, i) => (
                        <li key={i}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="font-medium text-foreground mt-4">Do you still want to schedule it?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              const pendingConflict = conflictData;
              setConflictData(null);
              if (pendingConflict) {
                performSaveEvent(pendingConflict.eventData, pendingConflict.sendSms);
              }
            }}>
              Continue Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isOptimizerDialogOpen} onOpenChange={setIsOptimizerDialogOpen}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Optimize Lesson Timing</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                {isOptimizing ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                    <p>Checking the ETA between each student address and adding a five-minute buffer...</p>
                    <p className="text-xs text-muted-foreground mt-2">Lesson order stays the same.</p>
                  </div>
                ) : optimizationResult ? (
                  <div>
                    <p className="mb-4 text-foreground">Here are the adjusted times for {format(currentDate, 'MMMM d')} using estimated travel time plus a five-minute buffer:</p>
                    <div className="max-h-[300px] overflow-y-auto space-y-3">
                      {optimizationResult.optimizedOrder.map((opt: any, index: number) => {
                        const originalEvent = eventsToOptimize.find(e => e.id === opt.eventId);
                        return (
                          <div key={opt.eventId} className="bg-muted p-3 rounded-md border flex items-start gap-3">
                            <div className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0 mt-0.5">
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{originalEvent?.studentName || 'Unknown Student'}</p>
                              <div className="flex items-center text-sm mt-1 gap-2">
                                <span className="line-through text-muted-foreground">{format(new Date(originalEvent?.start || ''), 'h:mm a')}</span>
                                <span>&rarr;</span>
                                <span className="font-semibold text-green-600 dark:text-green-400">{format(new Date(opt.suggestedStartTime), 'h:mm a')}</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">{opt.explanation}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p>Ready to optimize.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isOptimizing}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleApplyOptimization} 
              disabled={isOptimizing || !optimizationResult}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              Apply Timing Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
