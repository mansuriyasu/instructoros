import { NextRequest, NextResponse } from 'next/server';
import { notificationActor, notificationRateLimit } from '@/lib/server/notification-access';
import { requestSecurityErrorResponse } from '@/lib/server/request-security';
import { access, key, getPreferences, createNotification, expires } from '@/lib/server/notification-service';
import { categories, destinationUrl } from '@/lib/notifications';
import { RequestSecurityError } from '@/lib/server/request-security';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';

export const runtime = 'nodejs';
const NOTIFICATION_RETENTION_MS = 24 * 60 * 60 * 1000;
const deviceSchema = z.object({ action: z.literal('register'), token: z.string().min(20).max(4096), installationId: z.string().uuid(), platform: z.enum(['ios', 'android', 'desktop']) }).strict();
const prefsSchema = z.object({ action: z.literal('preferences'), pushEnabled: z.boolean(), lessonMinutes: z.union([z.literal(0), z.literal(15), z.literal(30), z.literal(60)]), categories: z.object(Object.fromEntries(categories.map(c => [c, z.boolean()])) as Record<typeof categories[number], z.ZodBoolean>).strict() }).strict();
const actionSchema = z.union([deviceSchema, prefsSchema, z.object({ action: z.literal('disable'), installationId: z.string().uuid() }).strict(), z.object({ action: z.literal('test') }).strict(), z.object({ action: z.literal('read'), id: z.string().regex(/^[a-f0-9]{64}$/).optional() }).strict()]);
const json = (data: unknown) => NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });

export async function GET(request: NextRequest) {
  try {
    const { uid, tenantId, db } = await notificationActor(request);
    const id = request.nextUrl.searchParams.get('open');
    if (id) {
      if (!/^[a-f0-9]{64}$/.test(id)) throw new RequestSecurityError('Notification not found.', 404);
      const ref = db.doc(`staffNotifications/${id}`);
      const n = (await ref.get()).data();
      if (!n || n.tenantId !== tenantId || n.recipientUid !== uid || !await access(tenantId, uid, n.destination)) throw new RequestSecurityError('This notification is unavailable in your current workspace.', 403);
      await ref.update({ readAt: Timestamp.now() });
      return json({ url: destinationUrl(n.destination) });
    }
    if (request.nextUrl.searchParams.get('settings') === '1') {
      const devices = await db.collection('pushDevices').where('userUid', '==', uid).get();
      return json({ preferences: await getPreferences(tenantId, uid), devices: devices.docs.filter(d => d.data().tenantId === tenantId && d.data().enabled).map(d => ({ installationId: d.data().installationId, platform: d.data().platform })), configured: !!process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY });
    }
    const preferenceRef = db.doc(`notificationPreferences/${key(tenantId, uid)}`);
    if (!(await preferenceRef.get()).data()?.legacyMigrated) {
      const legacy = await db.collection(`tenants/${tenantId}/notifications`).orderBy('createdAt', 'desc').limit(50).get();
      for (const old of legacy.docs) {
        const n = old.data();
        const createdAtMillis = Date.parse(n.createdAt);
        if (n.type !== 'student-registration' || !n.studentId || !Number.isFinite(createdAtMillis) || createdAtMillis < Date.now() - NOTIFICATION_RETENTION_MS) continue;
        const id = key(tenantId, uid, `registration:${n.studentId}`);
        if ((await db.doc(`staffNotifications/${id}`).get()).exists) continue;
        await createNotification({ tenantId, recipientUid: uid, eventKey: `registration:${n.studentId}`, type: 'student.registered', category: 'registrations', title: n.title || 'New student registered', message: `${n.studentName || 'A student'} completed registration.`, destination: { kind: 'student', id: n.studentId }, silent: true, createdAt: Timestamp.fromMillis(createdAtMillis) });
      }
      await preferenceRef.set({ legacyMigrated: true }, { merge: true });
    }
    const base = db.collection('staffNotifications').where('tenantId', '==', tenantId).where('recipientUid', '==', uid);
    const cutoff = Timestamp.fromMillis(Date.now() - NOTIFICATION_RETENTION_MS);
    const recent = base.where('createdAt', '>=', cutoff);
    let query = recent.orderBy('createdAt', 'desc').orderBy('__name__', 'desc').limit(21);
    const cursor = request.nextUrl.searchParams.get('cursor');
    if (cursor) {
      if (!/^[a-f0-9]{64}$/.test(cursor)) throw new RequestSecurityError('Invalid page.', 400);
      const c = await db.doc(`staffNotifications/${cursor}`).get();
      if (c.data()?.tenantId !== tenantId || c.data()?.recipientUid !== uid) throw new RequestSecurityError('Invalid page.', 400);
      query = query.startAfter(c);
    }
    const [records, count] = await Promise.all([query.get(), recent.where('readAt', '==', null).count().get()]);
    const items = [];
    for (const doc of records.docs.slice(0, 20)) {
      const n = doc.data();
      if (n.expiresAt.toMillis() <= Date.now() || !await access(tenantId, uid, n.destination)) continue;
      items.push({ id: doc.id, title: n.title, message: n.message, type: n.type, studentId: n.destination?.kind === 'student' ? n.destination.id : undefined, createdAt: n.createdAt.toDate().toISOString(), read: !!n.readAt });
    }
    return json({ items, unread: count.data().count, cursor: records.size > 20 ? records.docs[19].id : null });
  } catch (error) { return requestSecurityErrorResponse(error, 'Could not load notifications. Please try again.'); }
}
export async function POST(request: NextRequest) {
  try {
    const { uid, tenantId, db } = await notificationActor(request);
    const parsed = actionSchema.safeParse(await request.json());
    if (!parsed.success) throw new RequestSecurityError('Please check your notification settings.', 400);
    const input = parsed.data;
    await notificationRateLimit(uid, input.action, input.action === 'test' ? 3 : 60);
    if (input.action === 'register') {
      const device = db.doc(`pushDevices/${key(input.token)}`);
      await db.runTransaction(async tx => {
        const old = await tx.get(db.collection('pushDevices').where('userUid', '==', uid));
        const otherDevices = old.docs.filter(d => d.data().installationId !== input.installationId && d.id !== device.id);
        if (otherDevices.length >= 10) throw new RequestSecurityError('Ten devices are already registered. Disable notifications on an old device first.', 409);
        for (const doc of old.docs) if (doc.id !== device.id && doc.data().installationId === input.installationId) tx.delete(doc.ref);
        tx.set(device, { userUid: uid, tenantId, token: input.token, tokenVersion: key(input.token), installationId: input.installationId, platform: input.platform, enabled: true, createdAt: old.docs.find(d => d.id === device.id)?.data().createdAt || Timestamp.now(), updatedAt: Timestamp.now(), lastSeenAt: Timestamp.now(), expiresAt: expires() });
      });
    } else if (input.action === 'disable') {
      const devices = await db.collection('pushDevices').where('userUid', '==', uid).get();
      const batch = db.batch();
      for (const doc of devices.docs) if (doc.data().installationId === input.installationId) batch.delete(doc.ref);
      await batch.commit();
    } else if (input.action === 'preferences') {
      const p = { pushEnabled: input.pushEnabled, categories: input.categories, lessonMinutes: input.lessonMinutes };
      await db.doc(`notificationPreferences/${key(tenantId, uid)}`).set({ ...p, tenantId, userUid: uid, updatedAt: Timestamp.now() }, { merge: true });
    } else if (input.action === 'test') {
      const p = await getPreferences(tenantId, uid);
      if (!p.pushEnabled) throw new RequestSecurityError('Enable mobile notifications first.', 400);
      await createNotification({ tenantId, recipientUid: uid, eventKey: `test:${crypto.randomUUID()}`, type: 'test', title: 'InstructorOS notifications are ready', message: 'Your device can receive InstructorOS alerts.', destination: { kind: 'settings' } });
    } else {
      const query = db.collection('staffNotifications').where('tenantId', '==', tenantId).where('recipientUid', '==', uid);
      const docs = input.id ? [await db.doc(`staffNotifications/${input.id}`).get()] : (await query.where('readAt', '==', null).limit(450).get()).docs;
      const batch = db.batch();
      for (const doc of docs) if (doc.data()?.tenantId === tenantId && doc.data()?.recipientUid === uid) batch.update(doc.ref, { readAt: Timestamp.now() });
      await batch.commit();
      return json({ ok: true, more: !input.id && docs.length === 450 });
    }
    return json({ ok: true });
  } catch (error) { return requestSecurityErrorResponse(error, 'Could not update notifications. Please try again.'); }
}
