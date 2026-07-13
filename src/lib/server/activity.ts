import { getAdminFirestore } from '@/lib/server/firebase-admin';

export async function recordWorkspaceActivity(input: {
  tenantId: string;
  actorUid: string;
  actorEmail?: string | null;
  actorRole?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const activityRef = getAdminFirestore()
    .collection('tenants')
    .doc(input.tenantId)
    .collection('activity')
    .doc();

  await activityRef.set({
    actorUid: input.actorUid,
    actorEmail: input.actorEmail || null,
    actorRole: input.actorRole || null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId || null,
    metadata: input.metadata || {},
    createdAt: new Date().toISOString(),
  });
}
