const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, imports = {}) {
  const compiled = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { module: compiled, exports: compiled.exports, require: n => imports[n] || require(n), Date });
  return compiled.exports;
}
const { shouldRefreshOffline, OFFLINE_REFRESH_INTERVAL_MS } = load('src/lib/offline-refresh.ts');
test('opening and reconnecting reuse a fresh download; daily refresh still occurs', () => {
  const now = Date.parse('2026-09-18T12:00:00Z');
  assert.equal(shouldRefreshOffline(new Date(now - 5 * 60000).toISOString(), false, false, now), false);
  assert.equal(shouldRefreshOffline(new Date(now - OFFLINE_REFRESH_INTERVAL_MS).toISOString(), false, false, now), true);
  assert.equal(shouldRefreshOffline(undefined, false, false, now), true);
  assert.equal(shouldRefreshOffline('invalid', false, false, now), true);
  assert.equal(shouldRefreshOffline(new Date(now).toISOString(), true, false, now), true);
  assert.equal(shouldRefreshOffline(new Date(now).toISOString(), false, true, now), true);
});
test('calendar excludes past lessons at the database and preserves spanning lessons', () => {
  let observed;
  const react = { useMemo: fn => fn(), useEffect: () => {}, useState: v => [v, () => {}] };
  const firestore = { collection: () => ({}), query: (base, ...constraints) => ({ constraints: [...(base.constraints || []), ...constraints] }), where: (...args) => args, orderBy: (...args) => ['orderBy', ...args] };
  const events = [
    { id: 'past', start: '2026-09-01T10:00:00Z', end: '2026-09-01T11:00:00Z' },
    { id: 'spanning', start: '2026-09-17T10:00:00Z', end: '2026-09-20T11:00:00Z' },
    { id: 'visible', start: '2026-09-18T10:00:00Z', end: '2026-09-18T11:00:00Z' },
    { id: 'future', start: '2026-09-25T10:00:00Z', end: '2026-09-25T11:00:00Z' },
  ];
  const api = { useFirestore: () => ({}), useMemoFirebase: fn => fn(), useSession: () => ({ role: 'schoolAdmin', user: { uid: 'a' } }), useTenantCollectionPath: () => 'tenants/a/events', useCollection: (q, opts) => { observed = q; return { data: events.filter(opts.filter), isLoading: false }; } };
  const { useEvents } = load('src/hooks/use-events.ts', { react, 'firebase/firestore': firestore, '@/firebase': api, './use-students': { useStudents: () => ({ students: [] }) } });
  const result = useEvents(new Date('2026-09-18T00:00:00Z'), new Date('2026-09-19T00:00:00Z'));
  assert.equal(JSON.stringify(observed.constraints), JSON.stringify([['end', '>', '2026-09-18T00:00:00.000Z'], ['orderBy', 'end', 'asc']]));
  assert.equal(result.events.map(e => e.id).join(','), 'spanning,visible');
});
test('closed payment consumers do not subscribe; open consumers retain full financial records', () => {
  let observed;
  const base = { path: 'tenants/a/payments' };
  const { usePayments } = load('src/hooks/use-payments.ts', {
    react: { useMemo: fn => fn(), useCallback: fn => fn },
    'firebase/firestore': { collection: () => base },
    '@/firebase': {
      useFirestore: () => ({}), useSession: () => ({ user: { uid: 'admin' }, role: 'schoolAdmin' }),
      useTenantCollectionPath: () => base.path, useMemoFirebase: fn => fn(),
      useCollection: q => { observed = q; return { data: [], isLoading: false }; },
    },
  });
  usePayments({ load: false });
  assert.equal(observed, null);
  usePayments();
  assert.equal(observed, base);
});
