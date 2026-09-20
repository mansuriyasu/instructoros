const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, imports = {}, globals = {}) {
  const compiled = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports: compiled.exports, module: compiled, require: n => imports[n] || require(n), Date, Set, Map, ...globals });
  return compiled.exports;
}
const shared = load('src/lib/google-calendar-sync.ts');
const lesson = { id: 'lesson', title: 'Lesson', studentId: 'student', studentName: 'Local sample', instructorId: 'staff', start: '2026-11-01T06:30:00.000Z', end: '2026-11-01T07:30:00.000Z', services: [], googleEventIds: { staff: 'google-id' } };
class SecurityError extends Error { constructor(message, status) { super(message); this.status = status; } }
function server(options = {}) {
  const records = new Map([
    ['tenants/school', { status: 'active' }],
    ['tenants/school/members/staff', { status: 'active', role: 'schoolInstructor' }],
    ['tenants/school/students/student', { address: 'Local test address', assignedInstructorIds: ['staff'] }],
    ['tenants/school/events/lesson', structuredClone(lesson)],
  ]);
  let sends = 0;
  let sent;
  function ref(path) { return { collection: name => col(`${path}/${name}`), get: async () => ({ exists: records.has(path), data: () => records.get(path) }), update: async data => {
    if (!records.has(path)) throw Error('Deleted');
    for (const [key, value] of Object.entries(data)) { const [field, uid] = key.split('.'); records.get(path)[field] ||= {}; records.get(path)[field][uid] = value; }
  } }; }
  function col(path) { return { doc: id => ref(`${path}/${id}`) }; }
  const api = load('src/app/api/google-calendar/reconcile/route.ts', {
    'next/server': { NextResponse: { json: (data, opts) => ({ data, status: opts?.status || 200 }) } },
    '@/lib/server/firebase-admin': { getAdminFirestore: () => ({ collection: col }) },
    '@/lib/server/request-security': { requireAuthenticatedUser: async () => ({ uid: 'staff' }), enforceRateLimit: () => {}, RequestSecurityError: SecurityError, requestSecurityErrorResponse: e => ({ status: e.status || 500 }) },
    '@/lib/server/offline': { documentId: id => { if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(id)) throw new SecurityError('Invalid ID', 400); return id; }, assigned: s => s.assignedInstructorIds?.includes('staff'), assertAccess: (t, m) => { if (t?.status !== 'active' || m?.status !== 'active') throw new SecurityError('Forbidden', 403); } },
    '@/lib/google-calendar-sync': shared,
    '@/lib/google-calendar-server': { GoogleCalendarTokenError: class extends Error {}, getUserGoogleCalendarConnection: async () => options.disconnected ? null : {}, findGoogleCalendarEvent: async () => options.recoveredId || null, syncGoogleCalendarEvents: async entries => { sends++; sent = entries; if (options.during) options.during(records); return entries.map(e => options.fail ? { localId: e.localId, error: 'Google temporarily unavailable' } : { localId: e.localId, googleEventId: 'google-id' }); } },
  });
  return { records, call: body => api.POST({ json: async () => body || { tenantId: 'school', ids: ['lesson'] } }), sends: () => sends, sent: () => sent };
}
test('retry sends current stored time and preserves the Google event mapping', async () => {
  const api = server();
  api.records.get('tenants/school/events/lesson').start = '2026-11-02T16:00:00Z';
  assert.equal((await api.call()).status, 200);
  assert.equal(api.sent()[0].event.start.dateTime, '2026-11-02T16:00:00.000Z');
  await api.call(); assert.equal(api.sends(), 2);
  assert.equal(api.sent()[0].googleEventId, 'google-id');
});
test('Google failure does not acknowledge; subsequent retry succeeds', async () => {
  const api = server({ fail: true });
  assert.match((await api.call()).data.results[0].error, /unavailable/);
  assert.equal(api.records.get('tenants/school/events/lesson').googleSyncSignatures, undefined);
});
test('editing during sync preserves an unacknowledged newer version', async () => {
  const api = server({ during: records => { records.get('tenants/school/events/lesson').start = '2026-11-05T16:00:00Z'; } });
  await api.call(); const event = api.records.get('tenants/school/events/lesson');
  assert.notEqual(event.googleSyncSignatures.staff, shared.calendarSyncSignature(event));
});
test('tenant access, assignments, deleted records, disconnect and batch bounds are enforced', async () => {
  const api = server();
  assert.equal((await api.call({ tenantId: 'other', ids: ['lesson'] })).status, 403);
  api.records.get('tenants/school/events/lesson').instructorId = 'other';
  api.records.get('tenants/school/students/student').assignedInstructorIds = ['other'];
  assert.match((await api.call()).data.results[0].error, /assigned/);
  assert.equal(api.sends(), 0);
  api.records.delete('tenants/school/events/lesson');
  assert.equal((await api.call()).data.results[0].removed, true);
  assert.equal((await server({ disconnected: true }).call()).status, 412);
  assert.equal((await api.call({ tenantId: 'school', ids: Array(21).fill('lesson') })).status, 400);
});
test('DST timestamps preserve the exact instant; Google metadata does not change signature', () => {
  assert.equal(shared.storedCalendarPayload(lesson).start.dateTime, lesson.start);
  assert.equal(shared.calendarSyncSignature(lesson), shared.calendarSyncSignature({ ...lesson, googleEventIds: { staff: 'different' }, paymentId: 'paid' }));
});
function clientHarness(storage = new Map()) {
  const slots = []; let slot = 0; let effects = []; let interval;
  let now = 1000000; let calls = []; let responder;
  class Clock extends Date { static now() { return now; } }
  const session = { user: { uid: 'staff', getIdToken: async () => 'local-test-token' }, activeTenantId: 'school' };
  const react = {
    useRef: initial => { const i = slot++; slots[i] ||= { current: initial }; return slots[i]; },
    useState: initial => { const i = slot++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = value; }]; },
    useCallback: fn => fn,
    useEffect: fn => effects.push(fn),
  };
  const { useCalendarReconciliation: runHook } = load('src/hooks/use-calendar-reconciliation.ts', { react, '@/firebase': { useSession: () => session }, '@/lib/google-calendar-sync': shared }, {
    Date: Clock, crypto: require('node:crypto').webcrypto, AbortController, clearTimeout,
    localStorage: { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, v) },
    navigator: { onLine: true }, document: { hidden: false, addEventListener() {}, removeEventListener() {} },
    window: { setTimeout, setInterval: fn => { interval = fn; return 1; }, clearInterval() {}, addEventListener() {}, removeEventListener() {} },
    fetch: async (_, args) => { const body = JSON.parse(args.body); calls.push(body); return responder(body); },
  });
  const render = (events, connected = true) => { slot = 0; effects = []; const result = runHook(events, connected, false); effects.forEach(fn => fn()); return result; };
  return { render, storage, calls, session, respond: fn => { responder = fn; }, tick: async () => { now += 65000; interval(); await new Promise(resolve => setImmediate(resolve)); }, flush: () => new Promise(resolve => setImmediate(resolve)) };
}
test('disconnected edits survive reload and upload in batches instead of one request per lesson', async () => {
  const events = Array.from({ length: 25 }, (_, i) => ({ ...lesson, id: `lesson${i}` }));
  const first = clientHarness(); first.render(events, false);
  await first.tick(); assert.equal(first.calls.length, 0);
  const restored = clientHarness(first.storage);
  restored.respond(body => ({ ok: true, json: async () => ({ results: body.ids.map(id => ({ localId: id, signature: shared.calendarSyncSignature(events.find(e => e.id === id)) })) }) }));
  restored.render(events); await restored.tick();
  assert.equal(restored.calls[0].ids.length, 20);
  await restored.tick(); assert.equal(restored.calls[1].ids.length, 5);
  const status = restored.render(events);
  assert.equal(status.pending, 0);
  await restored.tick(); assert.equal(restored.calls.length, 2);
});
test('failed upload stays queued; a second edit during an upload is not discarded', async () => {
  const client = clientHarness();
  client.respond(() => ({ ok: false, json: async () => ({ error: 'Rate limited' }) }));
  let api = client.render([lesson]); await client.tick();
  assert.equal(client.render([lesson]).pending, 1);
  let resolve;
  client.respond(() => new Promise(r => { resolve = r; }));
  await client.tick();
  api = client.render([lesson]); api.enqueue(['lesson']);
  resolve({ ok: true, json: async () => ({ results: [{ localId: 'lesson', signature: shared.calendarSyncSignature(lesson) }] }) });
  await client.flush();
  assert.equal(client.render([lesson]).pending, 1);
});

test('lost mapping is recovered by stable ID even after moving to a different month', async () => {
  const api = server({ recoveredId: 'old-google-event' });
  const event = api.records.get('tenants/school/events/lesson');
  delete event.googleEventIds;
  event.start = '2027-01-10T15:00:00Z';
  await api.call();
  assert.equal(api.sent()[0].googleEventId, 'old-google-event');
});
