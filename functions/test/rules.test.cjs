const { test, before, after } = require('node:test');
const { readFileSync } = require('node:fs');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, setDoc, getDoc } = require('firebase/firestore');
let env;
const enabled = !!process.env.FIRESTORE_EMULATOR_HOST;
before(async () => {
  if (!enabled) return;
  env = await initializeTestEnvironment({ projectId: 'demo-instructoros-rules', firestore: { rules: readFileSync('../firestore.rules', 'utf8') } });
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'tenants/school'), { status: 'active', billingLocked: false });
    await setDoc(doc(db, 'tenants/school/members/alice'), { status: 'active', role: 'schoolInstructor' });
    await setDoc(doc(db, 'tenants/school/students/assigned'), { assignedInstructorIds: ['alice'] });
    await setDoc(doc(db, 'tenants/school/students/unrelated'), { assignedInstructorIds: ['bob'] });
    await setDoc(doc(db, 'staffNotifications/secret'), { recipientUid: 'alice', tenantId: 'school' });
  });
});
after(async () => { await env?.cleanup(); });
test('notification stores reject browser writes and reads, including platform-admin bypass', { skip: !enabled }, async () => {
  for (const context of [env.unauthenticatedContext(), env.authenticatedContext('alice', { email: 'alice@example.test' }), env.authenticatedContext('admin', { email: 'yasin_mansuri@live.com' })]) {
    for (const collection of ['staffNotifications', 'pushDevices', 'notificationPreferences', 'notificationJobs', 'notificationDeliveries', 'notificationRateLimits']) {
      await assertFails(setDoc(doc(context.firestore(), `${collection}/secret`), { recipientUid: 'bob' }));
      await assertFails(getDoc(doc(context.firestore(), `${collection}/secret`)));
    }
  }
});
test('existing instructor access to assigned students is preserved', { skip: !enabled }, async () => {
  const db = env.authenticatedContext('alice', { email: 'alice@example.test' }).firestore();
  await assertSucceeds(getDoc(doc(db, 'tenants/school/students/assigned')));
  await assertFails(getDoc(doc(db, 'tenants/school/students/unrelated')));
  await assertFails(getDoc(doc(db, 'tenants/other/students/assigned')));
});
