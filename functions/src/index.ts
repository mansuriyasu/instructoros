import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { onDocumentCreated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { setGlobalOptions } from 'firebase-functions/v2';
import { eventChanged } from './model';
import { createNotification, expires, key, notify, planLesson, processJob } from './notifications';

initializeApp();
setGlobalOptions({ region: 'northamerica-northeast2', serviceAccount: `instructoros-notifications@${process.env.GCLOUD_PROJECT || 'instructoros'}.iam.gserviceaccount.com`, maxInstances: 2, minInstances: 0, memory: '256MiB', timeoutSeconds: 120 });

export const registrationNotice = onDocumentCreated({ document: 'tenants/{tenantId}/notifications/{id}', retry: true }, async event => {
  const n = event.data?.data();
  if (n?.type !== 'student-registration' || !n.studentId) return;
  await notify({ tenantId: event.params.tenantId, eventKey: `registration:${n.studentId}`, type: 'student.registered', category: 'registrations', title: n.title || 'New student registered', message: `${n.studentName || 'A student'} completed registration.`, destination: { kind: 'student', id: n.studentId } });
});
export const availabilityNotice = onDocumentWritten({ document: 'tenants/{tenantId}/studentAvailability/{studentId}', retry: true }, async event => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!after || !before || !after.updatedByUid || JSON.stringify([before.weeklyWindows, before.overrides]) === JSON.stringify([after.weeklyWindows, after.overrides])) return;
  const student = (await getFirestore().doc(`tenants/${event.params.tenantId}/students/${event.params.studentId}`).get()).data();
  if (after.updatedByUid !== student?.portalUid) return;
  await notify({ tenantId: event.params.tenantId, eventKey: event.id, type: 'student.availability_updated', category: 'availability', title: 'Availability updated', message: `${student?.name || 'A student'} updated their availability.`, destination: { kind: 'availability', id: event.params.studentId } });
});
export const scheduleNotice = onDocumentWritten({ document: 'tenants/{tenantId}/events/{eventId}', retry: true }, async event => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (before && !after && before.instructorId) {
    await createNotification({ tenantId: event.params.tenantId, recipientUid: before.instructorId, eventKey: event.id, type: 'schedule.cancelled', category: 'schedule', title: 'Lesson removed', message: 'A lesson was removed from your schedule.', destination: { kind: 'schedule', date: before.start?.slice(0, 10) } });
  }
  if (after && (!before || eventChanged(before, after))) await planLesson(event.params.tenantId, event.params.eventId, after);
  if (!before || !after || !eventChanged(before, after)) return;
  const cancelled = after.lessonStatus === 'cancelled';
  await notify({ tenantId: event.params.tenantId, eventKey: event.id, type: cancelled ? 'schedule.cancelled' : 'schedule.changed', category: 'schedule', title: cancelled ? 'Lesson cancelled' : 'Schedule updated', message: `${after.studentName || 'Your lesson'} - ${cancelled ? 'lesson cancelled' : 'lesson details changed'}.`, destination: { kind: 'event', id: event.params.eventId, date: after.start?.slice(0, 10) } }, after.updatedByUid);
});
export const paymentNotice = onDocumentWritten({ document: 'tenants/{tenantId}/payments/{paymentId}', retry: true }, async event => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!after || Number(after.paidAmount) <= Number(before?.paidAmount || 0)) return;
  await notify({ tenantId: event.params.tenantId, eventKey: event.id, type: 'payment.recorded', category: 'payments', title: 'Payment recorded', message: `A payment was recorded for ${after.studentName || 'a student'}.`, destination: { kind: 'payment', id: event.params.paymentId } }, after.updatedByUid);
});
export const deliveryNotice = onDocumentCreated({ document: 'notificationJobs/{jobId}', retry: true }, async event => {
  if (event.data?.data().kind === 'push') await processJob(event.params.jobId);
});
export const reminderWorker = onSchedule({ schedule: 'every 1 minutes', maxInstances: 1 }, async () => {
  const jobs = await getFirestore().collection('notificationJobs').where('dueAt', '<=', Timestamp.now()).orderBy('dueAt').limit(100).get();
  // Keep provider concurrency and database reads bounded.
  for (let i = 0; i < jobs.docs.length; i += 5) await Promise.all(jobs.docs.slice(i, i + 5).map(doc => processJob(doc.id)));
});
export const preferenceReminders = onDocumentWritten({ document: 'notificationPreferences/{id}', retry: true }, async event => {
  const p = event.data?.after.data();
  if (!p?.tenantId || !p?.userUid || p.lessonMinutes === event.data?.before.data()?.lessonMinutes) return;
  const events = await getFirestore().collection(`tenants/${p.tenantId}/events`).where('instructorId', '==', p.userUid).where('start', '>=', new Date().toISOString()).orderBy('start').limit(500).get();
  for (const doc of events.docs) await planLesson(p.tenantId, doc.id, doc.data());
});
// The daily bounded horizon seeds pre-existing events and repairs missed trigger work.
export const reminderHorizon = onSchedule({ schedule: 'every day 00:10', timeZone: 'America/Toronto', maxInstances: 1 }, async () => {
  const db = getFirestore();
  const events = await db.collectionGroup('events').where('start', '>=', new Date().toISOString()).where('start', '<', new Date(Date.now() + 86400000 * 2).toISOString()).get();
  for (const doc of events.docs) {
    if (doc.ref.parent.parent?.parent.id === 'tenants') await planLesson(doc.ref.parent.parent.id, doc.id, doc.data());
  }
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
  const until = new Date(Date.now() + 8 * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
  const students = await db.collectionGroup('students').where('roadTest.date', '>=', today).where('roadTest.date', '<=', until).get();
  for (const doc of students.docs) {
    if (doc.ref.parent.parent?.parent.id !== 'tenants') continue;
    const roadTest = doc.data().roadTest;
    const tenantId = doc.ref.parent.parent.id;
    for (const days of [7, 1, 0]) {
      const reminderDay = new Date(`${roadTest.date}T12:00:00Z`);
      reminderDay.setUTCDate(reminderDay.getUTCDate() - days);
      const offset = reminderDay.toLocaleTimeString('en-US', { timeZone: 'America/Toronto', hourCycle: 'h23', hour: '2-digit' }) === '08' ? 4 : 5;
      const due = new Date(`${reminderDay.toISOString().slice(0, 10)}T${String(7 + offset).padStart(2, '0')}:00:00Z`).getTime();
      if (!Number.isFinite(due) || due <= Date.now()) continue;
      const version = JSON.stringify(roadTest);
      const ref = db.doc(`notificationJobs/${key('roadtest', tenantId, doc.id, version, String(days))}`);
      if (!(await ref.get()).exists) await ref.create({ kind: 'roadtest', tenantId, studentId: doc.id, version, days, dueAt: Timestamp.fromMillis(due), attempts: 0, expiresAt: expires(10) });
    }
  }
});
