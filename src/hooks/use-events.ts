'use client';

import { useMemo } from 'react';
import { CalendarEvent } from '@/lib/types';
import {
  useFirestore,
  useCollection,
  useMemoFirebase,
  addDocumentNonBlocking,
  updateDocumentNonBlocking,
  deleteDocumentNonBlocking,
} from '@/firebase';
import { collection, doc, query, where, orderBy } from 'firebase/firestore';
import { useStudents } from './use-students';

export function useEvents(startDate?: Date, endDate?: Date) {
  const firestore = useFirestore();
  const { students: allStudents } = useStudents();

  const eventsQuery = useMemoFirebase(
    () => {
      if (!firestore) return null;
      let q = query(collection(firestore, 'events'));
      
      if (startDate && endDate) {
        // Query for events that *end* after the start of the range
        // and *start* before the end of the range.
        // This ensures we catch events that span across the view boundaries.
        q = query(q, 
            where('start', '<=', endDate.toISOString()),
        );
      }
      
      // We are fetching a slightly wider range and filtering on the client
      // because Firestore doesn't support inequality filters on multiple fields ('start' and 'end').
      // This is a common strategy for calendar-like queries.
      // We order by start time to make client-side filtering and sorting efficient.
      q = query(q, orderBy('start', 'asc'));

      return q;
    },
    [firestore, startDate?.toISOString(), endDate?.toISOString()]
  );
  
  const filterFn = useMemo(() => {
    return (event: Omit<CalendarEvent, 'studentAddress'>) => {
        if (!startDate || !endDate) return true;
        const eventStart = new Date(event.start);
        const eventEnd = new Date(event.end);
        return eventStart < endDate && eventEnd > startDate;
    };
  }, [startDate?.toISOString(), endDate?.toISOString()]);

  const { data: events, isLoading } = useCollection<Omit<CalendarEvent, 'studentAddress'>>(eventsQuery, {
    filter: filterFn
  });

  const eventsWithAddress = useMemo(() => {
    if (!events || !allStudents) return [];
    return events.map(event => {
      const student = allStudents.find(s => s.id === event.studentId);
      return {
        ...event,
        studentAddress: student?.address,
      };
    });
  }, [events, allStudents]);

  const addEvent = async (event: Omit<CalendarEvent, 'id'>) => {
    if (!firestore) return;
    const { studentAddress, ...eventToSave } = event; // Don't save address to Firestore
    const eventsRef = collection(firestore, 'events');
    return addDocumentNonBlocking(eventsRef, eventToSave);
  };

  const updateEvent = async (event: Partial<CalendarEvent> & { id: string }) => {
    if (!firestore) return;
    const eventRef = doc(firestore, 'events', event.id);

    const { studentAddress, ...eventToSave } = event; // Don't save address to Firestore
    return updateDocumentNonBlocking(eventRef, eventToSave);
  };

  const deleteEvent = async (eventId: string) => {
    if (!firestore) return;
    const eventRef = doc(firestore, 'events', eventId);
    return deleteDocumentNonBlocking(eventRef);
  };

  return { events: eventsWithAddress || [], loading: isLoading, addEvent, updateEvent, deleteEvent };
}
