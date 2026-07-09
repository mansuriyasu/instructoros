import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('..', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');

const rules = read('firestore.rules');
assert.match(rules, /function canEditTenantProfile/);
assert.match(rules, /allow update: if isMainAdmin\(\) \|\| canEditTenantProfile\(tenantId\)/);
assert.match(rules, /request\.resource\.data\.billingLocked == true/);
assert.doesNotMatch(rules, /allow update: if isMainAdmin\(\) \|\| \(isActiveMember\(tenantId\) && role\(tenantId\) in \["schoolAdmin", "soloInstructor"\]\)/);

const checkout = read('src/app/api/billing/checkout/route.ts');
assert.match(checkout, /getBillingActor\(request, tenantId, \{ requireOwner: true \}\)/);
assert.match(checkout, /billingLocked: false/);

const deletion = read('src/app/api/account/delete-workspace/route.ts');
assert.match(deletion, /tenant\.ownerUid === decoded\.uid/);

const shortcut = read('src/app/api/shortcuts/license-scan/route.ts');
assert.match(shortcut, /SHORTCUT_TENANT_ID/);
assert.match(shortcut, /tenantId !== configuredTenantId/);

const inviteRoute = read('src/app/api/team/invites/route.ts');
assert.match(inviteRoute, /seatLimit/);
assert.match(inviteRoute, /membersSnap\.size \+ pendingInvites\.length >= seatLimit/);
assert.match(rules, /match \/invites\/\{inviteId\} \{[\s\S]*allow create: if isMainAdmin\(\);/);

for (const path of [
  'src/app/api/license-scan/route.ts',
  'src/app/api/receipt-scan/route.ts',
  'src/app/api/exam-scan/route.ts',
  'src/app/api/travel-time/route.ts',
  'src/app/api/optimize-route/route.ts',
]) {
  assert.match(read(path), /requireRateLimitedUser/);
}

console.log('Security boundary checks passed.');
