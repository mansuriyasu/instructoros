export const categories = ['registrations', 'availability', 'lessons', 'schedule', 'payments', 'roadTests'] as const;
export type Category = typeof categories[number];
export type NotificationType = 'student.registered' | 'student.availability_updated' | 'schedule.lesson_upcoming' | 'schedule.changed' | 'schedule.cancelled' | 'payment.recorded' | 'roadtest.upcoming' | 'test';
export type Destination = { kind: 'student' | 'availability' | 'event' | 'payment' | 'settings' | 'schedule'; id?: string; date?: string };
export type Preferences = { pushEnabled: boolean; categories: Record<Category, boolean>; lessonMinutes: 0 | 15 | 30 | 60 };
export const defaults: Preferences = { pushEnabled: false, categories: { registrations: true, availability: true, lessons: true, schedule: true, payments: false, roadTests: true }, lessonMinutes: 30 };
export function preferences(value?: Partial<Preferences>): Preferences {
  return { ...defaults, ...value, categories: { ...defaults.categories, ...value?.categories } };
}
export function destinationUrl(target: Destination): string {
  if (target.kind === 'settings') return '/app/settings?tab=notifications';
  if (target.kind === 'schedule') return target.date && /^\d{4}-\d{2}-\d{2}$/.test(target.date) ? `/app/schedule?date=${target.date}` : '/app/schedule';
  if (!target.id || !/^[\w-]{1,160}$/.test(target.id)) return '/app';
  const id = encodeURIComponent(target.id);
  if (target.kind === 'student') return `/app/students?studentId=${id}`;
  if (target.kind === 'availability') return `/app/students?studentId=${id}&section=availability`;
  if (target.kind === 'event') return `/app/schedule?eventId=${id}${target.date && /^\d{4}-\d{2}-\d{2}$/.test(target.date) ? `&date=${target.date}` : ''}`;
  if (target.kind === 'payment') return `/app/payments/history?paymentId=${id}`;
  return '/app';
}
export function eligibleMember(member: {status?: string; role?: string} | undefined): boolean {
  return member?.status === 'active' && ['soloInstructor', 'schoolAdmin', 'schoolInstructor'].includes(member.role || '');
}
export function canSee(member: {role?: string}, uid: string, entity: {assignedInstructorIds?: string[]; instructorId?: string}, kind: string): boolean {
  if (['schoolAdmin', 'soloInstructor'].includes(member.role || '')) return true;
  return kind === 'student' || kind === 'availability'
    ? Array.isArray(entity.assignedInstructorIds) && entity.assignedInstructorIds.includes(uid)
    : entity.instructorId === uid;
}
export function eventChanged(before: Record<string, unknown>, after: Record<string, unknown>): boolean {
  return ['start', 'end', 'studentId', 'instructorId', 'lessonStatus', 'services'].some(key => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
}
export function invalidToken(code?: string): boolean {
  return code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token';
}
