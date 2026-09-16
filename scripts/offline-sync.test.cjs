const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const cache = new Map();
function load(file, imports = {}) {
  const compiled = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const resolve = name => {
    if (imports[name]) return imports[name];
    if (name.startsWith('@/lib/')) {
      const path = `src/lib/${name.slice(6)}.ts`;
      if (!cache.has(path)) cache.set(path, load(path, imports));
      return cache.get(path);
    }
    return require(name);
  };
  vm.runInNewContext(code, { exports: compiled.exports, module: compiled, require: resolve, Date, Set, Map, Promise, URL });
  return compiled.exports;
}
class SecurityError extends Error { constructor(message, status) { super(message); this.status = status; } }
const security = { RequestSecurityError: SecurityError, requireRateLimitedUser: async () => ({ uid: 'staff', name: 'Instructor' }), requestSecurityErrorResponse: error => ({ status: error.status || 500, error: error.message }) };
const helper = load('src/lib/server/offline.ts', { './firebase-admin': {}, './request-security': security });
const schema = load('src/lib/offline-validation.ts');
const operation = { tenantId: 'school', id: 'aeb382e1-139a-4a20-a1d2-fdf2ed0c7bab', operation: { kind: 'note', payload: { studentId: 'student', lessonId: 'lesson', version: '1:1', notes: 'Practised parking.' } } };
function harness(options = {}) {
  const records = new Map([
    ['tenants/school', { status: 'active', subscriptionStatus: 'active', ...options.tenant }],
    ['tenants/school/members/staff', { status: 'active', role: 'schoolInstructor', ...options.member }],
    ['tenants/school/students/student', { name: 'Student', mobileNumber: '+1 (416) 555-0100', status: 'active', assignedInstructorIds: ['staff'], ...options.student }],
    ['tenants/school/events/lesson', { studentId: 'student', instructorId: 'staff', notes: 'Original', start: new Date().toISOString(), ...options.lesson }],
  ]);
  let writes = 0;
  const versions = new Map([['tenants/school/events/lesson', options.version || '1:1']]);
  const snapshot = path => { const version = (versions.get(path) || '1:1').split(':').map(Number); return { id: path.split('/').pop(), exists: records.has(path), data: () => records.get(path), updateTime: { seconds: version[0], nanoseconds: version[1] } }; };
  function collection(path) {
    return { path, doc: id => reference(`${path}/${id}`), select: () => collection(path), get: async () => ({ docs: [...records.keys()].filter(key => key.startsWith(path + '/') && !key.slice(path.length + 1).includes('/')).map(snapshot) }) };
  }
  function reference(path) { return { path, id: path.split('/').pop(), collection: name => collection(`${path}/${name}`), get: async () => snapshot(path) }; }
  const db = { collection, runTransaction: async callback => {
    const pending = [];
    const transaction = { get: ref => ref.get(), create: (ref, value) => { assert.equal(records.has(ref.path), false); pending.push([ref.path, value]); }, update: (ref, value) => pending.push([ref.path, { ...records.get(ref.path), ...value }]) };
    const result = await callback(transaction);
    for (const [path, value] of pending) { records.set(path, value); versions.set(path, '2:1'); writes++; }
    return result;
  } };
  const api = load('src/app/api/offline/sync/route.ts', {
    'next/server': { NextResponse: { json: (data, options) => ({ status: options?.status || 200, data }) } },
    '@/lib/server/request-security': security,
    '@/lib/offline-validation': schema,
    '@/lib/server/offline': { ...helper, offlineActor: async (_, tenantId) => { if (tenantId !== 'school') throw new SecurityError('Forbidden', 403); helper.assertAccess(records.get('tenants/school'), records.get('tenants/school/members/staff'), true); return { actor: { uid: 'staff', name: 'Instructor' }, tenantRef: reference('tenants/school'), db }; } },
  });
  return { call: (body = operation) => api.POST({ text: async () => JSON.stringify(body) }), records, writes: () => writes };
}
test('replaying an acknowledged draft writes only once', async () => {
  const api = harness();
  assert.equal((await api.call()).status, 200);
  assert.equal(api.records.get('tenants/school/events/lesson').notes, 'Practised parking.');
  const writes = api.writes();
  const replay = await api.call();
  assert.equal(replay.data.alreadySynced, true);
  assert.equal(api.writes(), writes);
  const changed = structuredClone(operation); changed.operation.payload.notes = 'different';
  assert.equal((await api.call(changed)).status, 409);
});
test('changed lesson stays unchanged and no receipt is created', async () => {
  const api = harness({ version: '3:9' });
  assert.equal((await api.call()).status, 409); assert.equal(api.writes(), 0);
});
test('revoked membership, billing and assignment are checked again on upload', async () => {
  for (const options of [{ member: { status: 'disabled' } }, { tenant: { billingLocked: true, subscriptionStatus: 'past_due' } }, { student: { assignedInstructorIds: ['other'] } }, { lesson: { instructorId: 'other' } }]) {
    const api = harness(options); assert.equal((await api.call()).status, 403); assert.equal(api.writes(), 0);
  }
});
test('deleted, merged and cancelled lesson links cannot accept offline writes', async () => {
  for (const options of [{ student: { mergedIntoStudentId: 'other' } }, { lesson: { studentId: 'other' } }, { lesson: { lessonStatus: 'cancelled' } }]) {
    const api = harness(options); assert.equal((await api.call()).status, 409); assert.equal(api.writes(), 0);
  }
});
test('cross-tenant and unsupported offline financial operations fail closed', async () => {
  const api = harness();
  assert.equal((await api.call({ ...operation, tenantId: 'other-school' })).status, 403);
  assert.equal((await api.call({ ...operation, operation: { kind: 'payment', payload: {} } })).status, 400);
  assert.equal(api.writes(), 0);
});
test('duplicate phone formats block student creation; a valid new draft is idempotent', async () => {
  const api = harness();
  const draft = { ...operation, operation: { kind: 'student', payload: { name: 'New student', mobileNumber: '4165550100', address: '', licenseType: 'G2', comments: '' } } };
  assert.equal((await api.call(draft)).status, 409);
  draft.operation.payload.mobileNumber = '4165550101';
  const created = await api.call(draft); assert.equal(created.status, 200);
  assert.equal(api.records.get(`tenants/school/students/${created.data.recordId}`).assignedInstructorIds[0], 'staff');
  assert.equal((await api.call(draft)).data.alreadySynced, true);
});
test('evaluation computes counts on the server and enforces lesson instructor', async () => {
  const draft = { ...operation, operation: { kind: 'evaluation', payload: { studentId: 'student', lessonId: 'lesson', version: '1:1', testType: 'G2', date: new Date().toISOString(), area: '', notes: '', items: [{ id: 'parking', name: 'Parking', category: 'parking', status: 'major', tags: [] }], autofails: [] } } };
  const api = harness(); const result = await api.call(draft); assert.equal(result.status, 200);
  const record = api.records.get(`tenants/school/evaluations/${result.data.recordId}`); assert.equal(record.major_count, 1); assert.equal(record.instructorUid, 'staff');
  assert.equal((await harness({ lesson: { instructorId: 'other' } }).call(draft)).status, 403);
});
