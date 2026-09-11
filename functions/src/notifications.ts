import { createHash } from 'node:crypto';
import { getFirestore, Timestamp, FieldValue, type DocumentData } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { canSee, eligibleMember, preferences, destinationUrl, invalidToken, type Category, type Destination, type NotificationType } from './model';

export const key = (...parts: string[]) => createHash('sha256').update(JSON.stringify(parts)).digest('hex');
export const expires = (days = 90) => Timestamp.fromMillis(Date.now() + days * 86400000);
export const notificationExpires = (createdAt: Timestamp) => Timestamp.fromMillis(createdAt.toMillis() + 86400000);
export async function access(tenantId: string, uid: string, target?: Destination) {
  const db = getFirestore();
  const tenant = db.doc(`tenants/${tenantId}`);
  const [t, m] = await Promise.all([tenant.get(), tenant.collection('members').doc(uid).get()]);
  if (t.data()?.status !== 'active' || !eligibleMember(m.data())) return false;
  if (!target || target.kind === 'settings' || target.kind === 'schedule') return true;
  if (!target.id || !/^[\w-]{1,160}$/.test(target.id)) return false;
  const collection = target.kind === 'event' ? 'events' : target.kind === 'payment' ? 'payments' : 'students';
  const entity = await tenant.collection(collection).doc(target.id).get();
  return entity.exists && canSee(m.data()!, uid, entity.data()!, target.kind);
}
export async function getPreferences(tenantId: string, uid: string) {
  return preferences((await getFirestore().doc(`notificationPreferences/${key(tenantId, uid)}`).get()).data());
}
export async function recipients(tenantId: string, target: Destination): Promise<string[]> {
  const members = await getFirestore().collection(`tenants/${tenantId}/members`).where('status', '==', 'active').get();
  const allowed = await Promise.all(members.docs.map(async m => await access(tenantId, m.id, target) ? m.id : null));
  return allowed.filter((uid): uid is string => !!uid);
}
export type Notice = { tenantId: string; recipientUid: string; eventKey: string; type: NotificationType; category?: Category; title: string; message: string; destination: Destination; silent?: boolean; createdAt?: Timestamp };
export async function createNotification(input: Notice) {
  if (!await access(input.tenantId, input.recipientUid, input.destination)) return;
  const db = getFirestore();
  const id = key(input.tenantId, input.recipientUid, input.eventKey);
  const notice = db.doc(`staffNotifications/${id}`);
  const settings = await getPreferences(input.tenantId, input.recipientUid);
  const { createdAt: requestedCreatedAt, ...noticeData } = input;
  const createdAt = requestedCreatedAt || Timestamp.now();
  const expiresAt = notificationExpires(createdAt);
  await db.runTransaction(async tx => {
    if ((await tx.get(notice)).exists) return;
    tx.create(notice, { ...noticeData, createdAt, expiresAt, readAt: null });
    if (expiresAt.toMillis() > Date.now() && !input.silent && settings.pushEnabled && (!input.category || settings.categories[input.category])) {
      tx.create(db.doc(`notificationJobs/${id}`), { kind: 'push', notificationId: id, tenantId: input.tenantId, recipientUid: input.recipientUid, dueAt: Timestamp.now(), attempts: 0, expiresAt: expires(7) });
    }
  });
  return id;
}
export async function notify(input: Omit<Notice, 'recipientUid'>, actorUid?: string) {
  for (const uid of await recipients(input.tenantId, input.destination)) {
    if (uid !== actorUid) await createNotification({ ...input, recipientUid: uid });
  }
}

export async function sendNotification(id: string) {
  const db = getFirestore();
  const record = await db.doc(`staffNotifications/${id}`).get();
  const n = record.data();
  if (!n || n.createdAt?.toMillis() < Date.now() - 86400000 || n.expiresAt?.toMillis() <= Date.now() || !await access(n.tenantId, n.recipientUid, n.destination)) return;
  const settings = await getPreferences(n.tenantId, n.recipientUid);
  if (!settings.pushEnabled || (n.category && !settings.categories[n.category as Category])) return;
  const devices = await db.collection('pushDevices').where('userUid', '==', n.recipientUid).get();
  let deliveryError: Error | undefined;
  for (const device of devices.docs) {
    const d = device.data();
    if (!d.enabled || d.tenantId !== n.tenantId || !d.token || d.lastSeenAt?.toMillis() < Date.now() - 90 * 86400000) continue;
    // A per-device marker preserves successful deliveries if a later device fails.
    const marker = db.doc(`notificationDeliveries/${key(id, device.id, d.tokenVersion || '')}`);
    if ((await marker.get()).exists) continue;
    try {
      await getMessaging().send({ token: d.token, data: { title: n.title, body: n.message, notificationId: id, path: destinationUrl(n.destination), recipientUid: n.recipientUid }, webpush: { headers: { TTL: '300', Urgency: 'normal' } } });
      await marker.set({ expiresAt: expires(7), deliveredAt: Timestamp.now() });
    } catch (error) {
      const code = (error as {code?: string}).code;
      if (invalidToken(code)) await device.ref.update({ enabled: false, token: FieldValue.delete(), updatedAt: Timestamp.now() });
      else deliveryError = new Error(`Push delivery failed: ${code || 'unknown'}`);
    }
  }
  if (deliveryError) throw deliveryError;
}

export async function processJob(id: string) {
  const db = getFirestore();
  const ref = db.doc(`notificationJobs/${id}`);
  const job = await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const d = snap.data();
    if (!d || d.dueAt.toMillis() > Date.now()) return null;
    if (d.attempts >= 5) { tx.update(ref, { dueAt: Timestamp.fromMillis(Date.now() + 365 * 86400000), failedAt: Timestamp.now() }); return null; }
    tx.update(ref, { dueAt: Timestamp.fromMillis(Date.now() + 120000), attempts: FieldValue.increment(1) });
    return d;
  });
  if (!job) return;
  try {
    if (job.kind === 'push') await sendNotification(job.notificationId);
    else await deliverReminder(job);
    await ref.delete();
  } catch (error) {
    console.error('notification_job_failed', { jobId: id, attempt: job.attempts + 1, code: (error as Error).message.slice(0, 100) });
    await ref.update({ dueAt: Timestamp.fromMillis(Date.now() + Math.min(3600000, 60000 * 2 ** job.attempts)) });
  }
}

export async function planLesson(tenantId: string, eventId: string, data: DocumentData) {
  if (data.lessonStatus === 'cancelled' || !data.instructorId || !Number.isFinite(Date.parse(data.start))) return;
  const settings = await getPreferences(tenantId, data.instructorId);
  if (!settings.lessonMinutes) return;
  const dueAt = Date.parse(data.start) - settings.lessonMinutes * 60000;
  if (dueAt < Date.now()) return;
  const id = key('lesson', tenantId, eventId, data.start, data.instructorId, String(settings.lessonMinutes));
  const ref = getFirestore().doc(`notificationJobs/${id}`);
  await getFirestore().runTransaction(async tx => {
    if (!(await tx.get(ref)).exists) tx.create(ref, { kind: 'lesson', tenantId, eventId, start: data.start, recipientUid: data.instructorId, minutes: settings.lessonMinutes, dueAt: Timestamp.fromMillis(dueAt), attempts: 0, expiresAt: expires(90) });
  });
}
export async function deliverReminder(job: DocumentData) {
  const db = getFirestore();
  if (job.kind === 'lesson') {
    const event = (await db.doc(`tenants/${job.tenantId}/events/${job.eventId}`).get()).data();
    const p = await getPreferences(job.tenantId, job.recipientUid);
    if (!event || event.start !== job.start || event.instructorId !== job.recipientUid || event.lessonStatus === 'cancelled' || p.lessonMinutes !== job.minutes || Date.parse(event.start) <= Date.now()) return;
    await createNotification({ tenantId: job.tenantId, recipientUid: job.recipientUid, eventKey: key('lesson', job.eventId, job.start, String(job.minutes)), type: 'schedule.lesson_upcoming', category: 'lessons', title: `Lesson in ${job.minutes} minutes`, message: `${event.studentName || 'Upcoming lesson'} - ${new Date(event.start).toLocaleTimeString('en-CA', { timeZone: 'America/Toronto', hour: 'numeric', minute: '2-digit' })}`, destination: { kind: 'event', id: job.eventId, date: event.start.slice(0, 10) } });
  } else if (job.kind === 'roadtest') {
    const student = (await db.doc(`tenants/${job.tenantId}/students/${job.studentId}`).get()).data();
    if (!student?.roadTest || JSON.stringify(student.roadTest) !== job.version || student.roadTest.date < new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })) return;
    await notify({ tenantId: job.tenantId, eventKey: key('roadtest', job.studentId, job.version, String(job.days)), type: 'roadtest.upcoming', category: 'roadTests', title: job.days === 0 ? 'Road test today' : `Road test in ${job.days} day${job.days === 1 ? '' : 's'}`, message: `${student.name || 'Student'} - ${student.roadTest.testType} at ${student.roadTest.time}`, destination: { kind: 'student', id: job.studentId } });
  }
}
