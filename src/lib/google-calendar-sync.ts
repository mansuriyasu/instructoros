import type { CalendarEvent } from '@/lib/types';
// Only fields sent to Google affect acknowledgement. IDs and payment metadata do not.
export function calendarSyncSignature(event: Partial<CalendarEvent>) {
  return JSON.stringify([event.title || '', event.start || '', event.end || '', event.studentId || '', event.studentName || '', event.notes || '', event.lessonStatus || 'scheduled', (event.services || []).map(s => s.name)]);
}
export function storedCalendarPayload(event: CalendarEvent) {
  return {
    summary: event.title,
    description: [event.studentName && event.studentName !== 'N/A' ? `Student: ${event.studentName}` : '', event.services?.length ? `Services: ${event.services.map(s => s.name).join(', ')}` : '', event.lessonStatus && event.lessonStatus !== 'scheduled' ? `Lesson status: ${event.lessonStatus}` : '', event.notes || '', 'Synced from InstructorOS.'].filter(Boolean).join('\n'),
    location: event.studentAddress || '',
    // ISO timestamps include their offset; Google converts them to Toronto time,
    // including DST, without reinterpreting UTC as local wall-clock time.
    start: { dateTime: new Date(event.start).toISOString(), timeZone: 'America/Toronto' },
    end: { dateTime: new Date(event.end).toISOString(), timeZone: 'America/Toronto' },
    extendedProperties: { private: { sparkonEventId: event.id } },
  };
}
