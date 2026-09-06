const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { initializeApp } = require('firebase-admin/app');
initializeApp({ projectId: 'demo-instructoros-notifications' });
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const model = require('../lib/model');
const service = require('../lib/notifications');
const db = getFirestore();
const emulator = !!process.env.FIRESTORE_EMULATOR_HOST;
const integration = (name, fn) => test(name, { skip: !emulator }, fn);
beforeEach(async () => {
  if (!emulator) return;
  await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-instructoros-notifications/databases/(default)/documents`, { method: 'DELETE' });
  await db.doc('tenants/school').set({ status: 'active' });
  await db.doc('tenants/school/members/alice').set({ role: 'schoolInstructor', status: 'active' });
  await db.doc('tenants/school/members/bob').set({ role: 'schoolInstructor', status: 'active' });
  await db.doc('tenants/school/students/student').set({ name: 'Test student', assignedInstructorIds: ['alice'] });
});
const notice = () => ({ tenantId: 'school', recipientUid: 'alice', eventKey: 'registration:student', type: 'student.registered', category: 'registrations', title: 'New student', message: 'Test student registered.', destination: { kind: 'student', id: 'student' } });

test('deep links reject injected URLs and malformed identifiers', () => {
  for (const id of ['//evil.test', '../login', 'a?next=https://evil.test', 'a/b', '<script>']) assert.equal(model.destinationUrl({ kind: 'student', id }), '/app');
  assert.equal(model.destinationUrl({ kind: 'availability', id: 'student' }), '/app/students?studentId=student&section=availability');
});
test('Google Calendar metadata does not create schedule changes', () => {
  assert.equal(model.eventChanged({ start: 'a', googleEventId: 'x' }, { start: 'a', googleEventId: 'y' }), false);
  assert.equal(model.eventChanged({ start: 'a' }, { start: 'b' }), true);
});
test('only active staff qualify, and instructors need assignments', () => {
  assert.equal(model.eligibleMember({ role: 'mainAdmin', status: 'active' }), false);
  assert.equal(model.eligibleMember({ role: 'schoolInstructor', status: 'disabled' }), false);
  assert.equal(model.canSee({ role: 'schoolInstructor' }, 'bob', { assignedInstructorIds: ['alice'] }, 'student'), false);
});
integration('correct recipient, independent inbox, no cross-tenant access', async () => {
  assert.equal(await service.access('school', 'alice', notice().destination), true);
  assert.equal(await service.access('school', 'bob', notice().destination), false);
  assert.equal(await service.access('other-school', 'alice', notice().destination), false);
  await service.createNotification({ ...notice(), recipientUid: 'bob' });
  assert.equal((await db.collection('staffNotifications').get()).size, 0);
});
integration('repeated and concurrent business events create one notification', async () => {
  await Promise.all([service.createNotification(notice()), service.createNotification(notice())]);
  assert.equal((await db.collection('staffNotifications').get()).size, 1);
  assert.equal((await db.collection('notificationJobs').get()).size, 0);
});
integration('provider failure preserves inbox and schedules retry', async () => {
  await db.doc(`notificationPreferences/${service.key('school', 'alice')}`).set({ pushEnabled: true });
  const id = await service.createNotification(notice());
  await db.doc('pushDevices/device').set({ userUid: 'alice', tenantId: 'school', token: 'fake', enabled: true, lastSeenAt: Timestamp.now() });
  const original = getMessaging().send;
  getMessaging().send = async () => { throw Object.assign(new Error('Temporary'), { code: 'messaging/server-unavailable' }); };
  try { await service.processJob(id); } finally { getMessaging().send = original; }
  assert.equal((await db.doc(`staffNotifications/${id}`).get()).exists, true);
  assert.equal((await db.doc(`notificationJobs/${id}`).get()).data().attempts, 1);
});
integration('expired tokens are disabled without failing other deliveries', async () => {
  await db.doc(`notificationPreferences/${service.key('school', 'alice')}`).set({ pushEnabled: true });
  const id = await service.createNotification(notice());
  await db.doc('pushDevices/device').set({ userUid: 'alice', tenantId: 'school', token: 'fake', enabled: true, lastSeenAt: Timestamp.now() });
  const original = getMessaging().send;
  getMessaging().send = async () => { throw Object.assign(new Error('Invalid'), { code: 'messaging/registration-token-not-registered' }); };
  try { await service.sendNotification(id); } finally { getMessaging().send = original; }
  assert.equal((await db.doc('pushDevices/device').get()).data().enabled, false);
});
integration('inactive members and disabled categories do not receive push', async () => {
  await db.doc(`notificationPreferences/${service.key('school', 'alice')}`).set({ pushEnabled: true, categories: { registrations: false } });
  await service.createNotification(notice());
  assert.equal((await db.collection('notificationJobs').get()).size, 0);
  await db.doc('tenants/school/members/alice').update({ status: 'disabled' });
  assert.equal(await service.createNotification({ ...notice(), eventKey: 'second' }), undefined);
});
integration('rescheduled and cancelled reminders are discarded', async () => {
  const start = new Date(Date.now() + 3600000).toISOString();
  await db.doc('tenants/school/events/lesson').set({ start, instructorId: 'alice', studentName: 'Test', lessonStatus: 'cancelled' });
  await service.deliverReminder({ kind: 'lesson', tenantId: 'school', eventId: 'lesson', recipientUid: 'alice', minutes: 30, start });
  assert.equal((await db.collection('staffNotifications').get()).size, 0);
  await db.doc('tenants/school/events/lesson').update({ lessonStatus: 'scheduled', start: new Date(Date.now() + 7200000).toISOString() });
  await service.deliverReminder({ kind: 'lesson', tenantId: 'school', eventId: 'lesson', recipientUid: 'alice', minutes: 30, start });
  assert.equal((await db.collection('staffNotifications').get()).size, 0);
});
