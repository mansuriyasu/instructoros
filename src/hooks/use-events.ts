'use client';

import { useMemo } from 'react';
import { CalendarEvent } from '@/lib/types';
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
import { collection, doc, or, query, where, orderBy } from 'firebase/firestore';
import { useStudents } from './use-students';

export function useEvents(startDate?: Date, endDate?: Date) {
  const firestore = useFirestore();
  const { user, role, isSessionLoading } = useSession();
  const eventsPath = useTenantCollectionPath('events');
  const { students: allStudents } = useStudents();
  const assignedStudentIds = useMemo(
    () => (role === 'schoolInstructor' ? (allStudents || []).map(student => student.id).filter(Boolean) : []),
    [allStudents, role]
  );
  const startDateIso = startDate?.toISOString();
  const endDateIso = endDate?.toISOString();

  const eventsQuery = useMemoFirebase(
    () => {
      if (!firestore || !eventsPath || isSessionLoading || !role) return null;
      let q = query(collection(firestore, eventsPath));
      
      if (startDateIso && endDateIso) {
        // Query for events that *end* after the start of the range
        // and *start* before the end of the range.
        // This ensures we catch events that span across the view boundaries.
        q = query(q, 
            where('start', '<=', endDateIso),
        );
      }

      if (role === 'schoolInstructor' && user) {
        // Some older lessons were created before instructorId was required. Keep
        // those visible when their student is assigned to this instructor.
        const assignmentFilters = [where('instructorId', '==', user.uid)];
        if (assignedStudentIds.length > 0 && assignedStudentIds.length <= 30) {
          assignmentFilters.push(where('studentId', 'in', assignedStudentIds));
          q = query(q, or(...assignmentFilters));
        } else {
          q = query(q, assignmentFilters[0]);
        }
      }
      
      // We are fetching a slightly wider range and filtering on the client
      // because Firestore doesn't support inequality filters on multiple fields ('start' and 'end').
      // This is a common strategy for calendar-like queries.
      // We order by start time to make client-side filtering and sorting efficient.
      q = query(q, orderBy('start', 'asc'));

      return q;
    },
    [assignedStudentIds, endDateIso, eventsPath, firestore, isSessionLoading, role, startDateIso, user]
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
    if (!firestore || !eventsPath) return;
    const { studentAddress, ...eventToSave } = event; // Don't save address to Firestore
    const eventsRef = collection(firestore, eventsPath);
    return addDocumentNonBlocking(eventsRef, {
      ...eventToSave,
      instructorId: eventToSave.instructorId || user?.uid || null,
    });
  };

  const updateEvent = async (event: Partial<CalendarEvent> & { id: string }) => {
    if (!firestore || !eventsPath) return;
    const eventRef = doc(firestore, eventsPath, event.id);

    const { studentAddress, ...eventToSave } = event; // Don't save address to Firestore
    return updateDocumentNonBlocking(eventRef, eventToSave);
  };

  const deleteEvent = async (eventId: string) => {
    if (!firestore || !eventsPath) return;
    const eventRef = doc(firestore, eventsPath, eventId);
    return deleteDocumentNonBlocking(eventRef);
  };

  return { events: eventsWithAddress || [], loading: isLoading, addEvent, updateEvent, deleteEvent };
}
