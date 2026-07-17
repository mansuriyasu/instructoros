'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Evaluation } from '@/lib/types';
import { useFirestore, useSession, useTenantCollectionPath, useUser } from '@/firebase';
import { getAuthenticatedHeaders } from '@/lib/authenticated-fetch';
import { collection, getDocs, query, where } from 'firebase/firestore';

export function useEvaluations(studentId?: string, lessonId?: string) {
  const { activeTenantId, role } = useSession();
  const { user } = useUser();
  const firestore = useFirestore();
  const evaluationsPath = useTenantCollectionPath('evaluations');
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user || !activeTenantId || (!studentId && !lessonId)) {
      setEvaluations([]);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ tenantId: activeTenantId });
      if (studentId) params.set('studentId', studentId);
      if (lessonId) params.set('lessonId', lessonId);
      const response = await fetch(`/api/evaluations?${params.toString()}`, { headers: await getAuthenticatedHeaders() });
      const result = await response.json().catch(() => ({}));
      if (response.ok) {
        setEvaluations(result.evaluations || []);
        return;
      }

      if (!firestore || !evaluationsPath) throw new Error(result.error || 'Could not load evaluations.');
      const constraints = [];
      if (studentId) constraints.push(where('studentId', '==', studentId));
      if (lessonId) constraints.push(where('lessonId', '==', lessonId));
      if (role === 'schoolInstructor') constraints.push(where('instructorUid', '==', user.uid));
      const snapshots = await getDocs(query(collection(firestore, evaluationsPath), ...constraints));
      setEvaluations(snapshots.docs.map(snapshot => ({ id: snapshot.id, ...snapshot.data() } as Evaluation)).sort((a, b) => b.date.localeCompare(a.date)));
    } catch {
      setEvaluations([]);
    } finally {
      setLoading(false);
    }
  }, [activeTenantId, evaluationsPath, firestore, lessonId, role, studentId, user]);

  useEffect(() => { void load(); }, [load]);

  return { evaluations, loading, reload: load };
}
