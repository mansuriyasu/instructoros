import { z } from 'zod';
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,160}$/);
const text = z.string().trim().max(4000);
const link = { studentId: id, lessonId: id, version: z.string().min(1).max(80) };
export const offlineOperation = z.object({
  tenantId: id,
  id: z.string().uuid(),
  operation: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('student'), payload: z.object({ name: z.string().trim().min(1).max(160), mobileNumber: z.string().trim().max(40), address: z.string().trim().max(500), licenseType: z.enum(['G1', 'G2', 'G', 'Other']), comments: text }) }),
    z.object({ kind: z.literal('note'), payload: z.object({ ...link, notes: text }) }),
    z.object({ kind: z.literal('evaluation'), payload: z.object({ ...link, testType: z.enum(['G2', 'G']), date: z.string().datetime(), area: z.string().trim().max(300), notes: text, items: z.array(z.object({ id: z.string().min(1).max(100), name: z.string().min(1).max(300), category: z.string().max(40), status: z.enum(['ok', 'minor', 'major']), tags: z.array(z.string().max(100)).max(20) })).min(1).max(100), autofails: z.array(z.string().max(300)).max(30) }) }),
  ]),
});
