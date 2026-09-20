import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/server/firebase-admin';
import { requireAuthenticatedUser, enforceRateLimit, RequestSecurityError, requestSecurityErrorResponse } from '@/lib/server/request-security';
import { assigned, documentId, assertAccess } from '@/lib/server/offline';
import { getUserGoogleCalendarConnection, findGoogleCalendarEvent, syncGoogleCalendarEvents, GoogleCalendarTokenError } from '@/lib/google-calendar-server';
import { calendarSyncSignature, storedCalendarPayload } from '@/lib/google-calendar-sync';
import type { CalendarEvent } from '@/lib/types';
export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  try {
    const actor = await requireAuthenticatedUser(request);
    enforceRateLimit(`google-calendar-sync:${actor.uid}`, 6, 60000);
    const body = await request.json();
    const tenantId = documentId(body.tenantId);
    if (!Array.isArray(body.ids) || !body.ids.length || body.ids.length > 20) throw new RequestSecurityError('Choose between 1 and 20 appointments.', 400);
    const ids = [...new Set<string>(body.ids.map(documentId))];
    const tenantRef = getAdminFirestore().collection('tenants').doc(tenantId);
    const [tenant, member] = await Promise.all([tenantRef.get(), tenantRef.collection('members').doc(actor.uid).get()]);
    assertAccess(tenant.data(), member.data(), true);
    const config = await getUserGoogleCalendarConnection(actor.uid);
    if (!config) throw new RequestSecurityError('Reconnect Google Calendar to upload pending changes.', 412);
    const results: Array<{ localId: string; signature?: string; error?: string; removed?: boolean }> = [];
    const prepared = [];
    for (const id of ids) {
      const ref = tenantRef.collection('events').doc(id);
      const snapshot = await ref.get();
      if (!snapshot.exists) { results.push({ localId: id, removed: true }); continue; }
      const event = { ...snapshot.data(), id } as CalendarEvent;
      const student = event.studentId ? (await tenantRef.collection('students').doc(documentId(event.studentId)).get()).data() : undefined;
      if (member.data()!.role === 'schoolInstructor' && event.instructorId !== actor.uid && (!student || !assigned(student, actor.uid))) {
        results.push({ localId: id, error: 'This appointment is no longer assigned to you.' }); continue;
      }
      const signature = calendarSyncSignature(event);
      // Always use current database fields, never a queued browser payload.
      const payload = storedCalendarPayload({ ...event, studentAddress: String(student?.address || '') });
      // A reschedule can move outside the old date window. Recover its mapping
      // by stable appointment ID before considering creation of another event.
      const googleEventId = event.googleEventIds?.[actor.uid] || event.googleEventId
        || await findGoogleCalendarEvent(id, undefined, config) || undefined;
      prepared.push({ ref, signature, entry: { localId: id, googleEventId, event: payload } });
    }
    if (prepared.length) {
      const synced = await syncGoogleCalendarEvents(prepared.map(item => item.entry), config);
      for (const result of synced) {
        const item = prepared.find(item => item.entry.localId === result.localId)!;
        if (result.error || !result.googleEventId) { results.push({ localId: result.localId, error: result.error || 'Google did not confirm this update.' }); continue; }
        try {
          // The signature describes exactly what Google acknowledged. If the
          // lesson changed during the request, its new signature stays pending.
          await item.ref.update({ [`googleEventIds.${actor.uid}`]: result.googleEventId, [`googleSyncSignatures.${actor.uid}`]: item.signature });
          results.push({ localId: result.localId, signature: item.signature });
        } catch { results.push({ localId: result.localId, error: 'Google updated, but confirmation could not be saved. Retry required.' }); }
      }
    }
    return NextResponse.json({ results }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof GoogleCalendarTokenError) return NextResponse.json({ error: 'Reconnect Google Calendar to upload pending changes.' }, { status: 412 });
    return requestSecurityErrorResponse(error, 'Google Calendar update failed. Changes remain pending.');
  }
}
