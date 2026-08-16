'use client';

import { useState, useEffect } from 'react';
import { useSession, useFirestore } from '@/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { AvailabilityWindow, StudentAvailability } from '@/lib/types';
import { Clock3, Link as LinkIcon, Loader2, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const defaultWindow = { startTime: '07:00', endTime: '20:00' };

function normalizeAvailability(availability: StudentAvailability | null, tenantId: string, studentId: string) {
  return {
    tenantId,
    studentId,
    timezone: availability?.timezone || 'America/Toronto',
    weeklyWindows: Array.isArray(availability?.weeklyWindows) ? availability.weeklyWindows : [],
    overrides: Array.isArray(availability?.overrides) ? availability.overrides : [],
  };
}

export function StudentAvailabilityPanel({ studentId, studentName }: { studentId: string, studentName: string }) {
  const { tenant } = useSession();
  const db = useFirestore();
  const { toast } = useToast();
  const [availability, setAvailability] = useState<StudentAvailability | null>(null);
  const [draftWindows, setDraftWindows] = useState<AvailabilityWindow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tenant?.id || !studentId || !db) return;
    const unsub = onSnapshot(doc(db, 'tenants', tenant.id, 'studentAvailability', studentId), (doc) => {
      if (doc.exists()) {
        const nextAvailability = doc.data() as StudentAvailability;
        setAvailability(nextAvailability);
        setDraftWindows(Array.isArray(nextAvailability.weeklyWindows) ? nextAvailability.weeklyWindows : []);
      } else {
        setAvailability(null);
        setDraftWindows([]);
      }
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [db, tenant?.id, studentId]);

  const addWindow = (weekday: number) => {
    setDraftWindows((current) => [
      ...current,
      { weekday, startTime: defaultWindow.startTime, endTime: defaultWindow.endTime },
    ]);
  };

  const updateWindow = (targetIndex: number, field: 'startTime' | 'endTime', value: string) => {
    setDraftWindows((current) =>
      current.map((window, index) =>
        index === targetIndex ? { ...window, [field]: value } : window,
      ),
    );
  };

  const removeWindow = (targetIndex: number) => {
    setDraftWindows((current) => current.filter((_, index) => index !== targetIndex));
  };

  const saveAvailability = async () => {
    if (!db || !tenant?.id || !studentId) return;
    const invalidWindow = draftWindows.find(
      (window) =>
        window.startTime < '07:00' ||
        window.endTime > '20:00' ||
        window.startTime >= window.endTime,
    );
    if (invalidWindow) {
      toast({
        variant: 'destructive',
        title: 'Check availability time',
        description: 'Availability must be between 7:00 AM and 8:00 PM, and the end time must be after the start time.',
      });
      return;
    }

    setSaving(true);
    try {
      const data = normalizeAvailability(availability, tenant.id, studentId);
      await setDoc(
        doc(db, 'tenants', tenant.id, 'studentAvailability', studentId),
        {
          ...data,
          weeklyWindows: draftWindows,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
      toast({ title: 'Availability saved' });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Could not save availability',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

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
        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">7 AM - 8 PM</span>
      </div>

      {!availability && draftWindows.length === 0 && (
        <p className="text-sm text-muted-foreground mb-2">No availability configured.</p>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <span className={`h-2 w-2 rounded-full ${draftWindows.length > 0 ? 'bg-green-500' : 'bg-amber-500'}`} />
          <span className="font-medium">
            {draftWindows.length > 0 ? 'Availability configured' : 'Pending availability'}
          </span>
        </div>

        {weekdays.map((day, weekday) => {
          const dayWindows = draftWindows
            .map((window, index) => ({ window, index }))
            .filter(({ window }) => window.weekday === weekday);

          return (
            <div key={day} className="rounded-xl border border-border/40 bg-background p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">{day}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => addWindow(weekday)}
                >
                  Add time
                </Button>
              </div>
              <div className="mt-2 grid gap-2">
                {dayWindows.length === 0 && (
                  <p className="text-xs text-muted-foreground">Not available</p>
                )}
                {dayWindows.map(({ window, index }) => (
                  <div key={`${day}-${index}`} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                    <label className="space-y-1 text-xs font-semibold text-muted-foreground">
                      From
                      <Input
                        type="time"
                        min="07:00"
                        max="20:00"
                        step="900"
                        value={window.startTime || defaultWindow.startTime}
                        onChange={(event) => updateWindow(index, 'startTime', event.target.value)}
                      />
                    </label>
                    <label className="space-y-1 text-xs font-semibold text-muted-foreground">
                      To
                      <Input
                        type="time"
                        min="07:00"
                        max="20:00"
                        step="900"
                        value={window.endTime || defaultWindow.endTime}
                        onChange={(event) => updateWindow(index, 'endTime', event.target.value)}
                      />
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="mb-0.5 h-9 w-9"
                      onClick={() => removeWindow(index)}
                      aria-label={`Remove ${day} availability`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <Button
          type="button"
          className="w-full bg-[#C9A84C] text-[#0D1B2A] hover:bg-[#F0D080]"
          onClick={saveAvailability}
          disabled={saving}
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {saving ? 'Saving...' : 'Save availability'}
        </Button>
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Student can still update this later from the student portal.
        </p>
      </div>
    </div>
  );
}
