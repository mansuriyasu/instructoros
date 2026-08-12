'use client';

import { useState, useEffect } from 'react';
import { useSession, useFirestore } from '@/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { StudentAvailability } from '@/lib/types';
import { Link as LinkIcon } from 'lucide-react';

export function StudentAvailabilityPanel({ studentId, studentName }: { studentId: string, studentName: string }) {
  const { tenant } = useSession();
  const db = useFirestore();
  const [availability, setAvailability] = useState<StudentAvailability | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenant?.id || !studentId || !db) return;
    const unsub = onSnapshot(doc(db, 'tenants', tenant.id, 'studentAvailability', studentId), (doc) => {
      if (doc.exists()) {
        setAvailability(doc.data() as StudentAvailability);
      } else {
        setAvailability(null);
      }
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [db, tenant?.id, studentId]);

  if (loading) {
    return <div className="text-sm text-muted-foreground animate-pulse">Loading availability...</div>;
  }

  return (
    <div aria-label={`${studentName} availability`} className="relative z-10 rounded-2xl border border-border/50 bg-muted/30 p-4 mt-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <LinkIcon className="h-4 w-4 text-[#C9A84C]" />
          Student Availability
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">Student portal only</span>
      </div>

      {!availability && (
        <p className="text-sm text-muted-foreground mb-2">No availability configured.</p>
      )}

      {availability && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <span className={`w-2 h-2 rounded-full ${availability.weeklyWindows?.length > 0 ? 'bg-green-500' : 'bg-amber-500'}`} />
            <span className="font-medium">
              {availability.weeklyWindows?.length > 0 ? 'Availability Submitted' : 'Pending Submission'}
            </span>
          </div>
          {availability.weeklyWindows?.length > 0 && (
             <p className="text-xs text-muted-foreground">
               {availability.weeklyWindows.length} weekly windows, {availability.overrides?.length || 0} date overrides.
             </p>
          )}
          <p className="pt-2 text-xs text-muted-foreground">The student signs in to InstructorOS to update availability. Staff can view the saved hours here.</p>
        </div>
      )}
    </div>
  );
}
