'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AvailabilityWindow, AvailabilityOverride } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AvailabilityPage() {
  const { token } = useParams() as { token: string };
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [studentName, setStudentName] = useState('Student');

  const [weeklyWindows, setWeeklyWindows] = useState<AvailabilityWindow[]>([]);
  const [overrides, setOverrides] = useState<AvailabilityOverride[]>([]);

  useEffect(() => {
    fetch(`/api/availability/public/${token}`)
      .then(res => res.json())
      .then(data => {
        if (!data.ok) {
          setError(data.error);
        } else {
          setStudentName(data.studentName);
          setWeeklyWindows(data.availability?.weeklyWindows || []);
          setOverrides(data.availability?.overrides || []);
        }
      })
      .catch(() => setError('Failed to load availability.'))
      .finally(() => setLoading(false));
  }, [token]);

  const saveAvailability = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch(`/api/availability/public/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weeklyWindows, overrides })
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error);
      } else {
        setSuccess(true);
      }
    } catch {
      setError('Failed to save availability.');
    } finally {
      setSaving(false);
    }
  };

  const addWeeklyWindow = (weekday: number) => {
    setWeeklyWindows([...weeklyWindows, { weekday, startTime: '09:00', endTime: '17:00' }]);
  };

  const removeWeeklyWindow = (index: number) => {
    setWeeklyWindows(weeklyWindows.filter((_, i) => i !== index));
  };

  const updateWeeklyWindow = (index: number, field: keyof AvailabilityWindow, value: any) => {
    const nw = [...weeklyWindows];
    nw[index] = { ...nw[index], [field]: value };
    setWeeklyWindows(nw);
  };

  const addOverride = () => {
    setOverrides([...overrides, { date: new Date().toISOString().split('T')[0], available: false }]);
  };

  const removeOverride = (index: number) => {
    setOverrides(overrides.filter((_, i) => i !== index));
  };

  const updateOverride = (index: number, field: keyof AvailabilityOverride, value: any) => {
    const no = [...overrides];
    no[index] = { ...no[index], [field]: value };
    setOverrides(no);
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  if (error && !studentName) return <div className="p-8 text-center text-destructive font-medium">{error}</div>;

  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col p-4 sm:p-8">
      <div className="max-w-md w-full mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Set Availability</h1>
          <p className="text-sm text-slate-500 mt-1">Hello, {studentName}!</p>
        </div>

        {error && <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm">{error}</div>}
        {success && <div className="p-3 bg-green-100 text-green-700 rounded-md text-sm">Availability saved successfully!</div>}

        <Tabs defaultValue="weekly" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="overrides">Exceptions</TabsTrigger>
          </TabsList>

          <TabsContent value="weekly" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recurring Hours</CardTitle>
                <CardDescription>When are you generally available each week?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {weekdays.map((dayName, dayIndex) => {
                  const dayWindows = weeklyWindows.filter(w => w.weekday === dayIndex);
                  return (
                    <div key={dayIndex} className="space-y-2 border-b pb-4 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between">
                        <Label className="font-semibold text-base">{dayName}</Label>
                        <Button variant="outline" size="sm" onClick={() => addWeeklyWindow(dayIndex)}>
                          + Add Time
                        </Button>
                      </div>

                      {dayWindows.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Not available</p>
                      ) : (
                        dayWindows.map((w, wIndex) => {
                          const globalIndex = weeklyWindows.findIndex(gw => gw === w);
                          return (
                            <div key={wIndex} className="flex items-center gap-2">
                              <Input
                                type="time"
                                value={w.startTime}
                                onChange={(e) => updateWeeklyWindow(globalIndex, 'startTime', e.target.value)}
                              />
                              <span>to</span>
                              <Input
                                type="time"
                                value={w.endTime}
                                onChange={(e) => updateWeeklyWindow(globalIndex, 'endTime', e.target.value)}
                              />
                              <Button variant="ghost" size="sm" onClick={() => removeWeeklyWindow(globalIndex)} className="text-destructive">
                                X
                              </Button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="overrides" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Specific Dates</CardTitle>
                <CardDescription>Add exceptions for specific days (e.g. holidays, vacations).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button variant="outline" onClick={addOverride} className="w-full">+ Add Date Override</Button>

                {overrides.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center">No specific dates added.</p>
                )}

                {overrides.map((o, index) => (
                  <div key={index} className="p-3 border rounded-md space-y-3 bg-white">
                    <div className="flex items-center justify-between">
                      <Input
                        type="date"
                        value={o.date}
                        className="w-auto"
                        onChange={(e) => updateOverride(index, 'date', e.target.value)}
                      />
                      <Button variant="ghost" size="sm" onClick={() => removeOverride(index)} className="text-destructive h-8 px-2">
                        Remove
                      </Button>
                    </div>

                    <div className="flex items-center gap-2">
                      <Label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={o.available}
                          onChange={(e) => updateOverride(index, 'available', e.target.checked)}
                        />
                        Available on this date
                      </Label>
                    </div>

                    {o.available && (
                      <div className="flex items-center gap-2 pt-2 border-t">
                        <Input
                          type="time"
                          value={o.startTime || '09:00'}
                          onChange={(e) => updateOverride(index, 'startTime', e.target.value)}
                        />
                        <span>to</span>
                        <Input
                          type="time"
                          value={o.endTime || '17:00'}
                          onChange={(e) => updateOverride(index, 'endTime', e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Button onClick={saveAvailability} disabled={saving} className="w-full h-12 text-lg">
          {saving ? 'Saving...' : 'Save Availability'}
        </Button>
      </div>
    </div>
  );
}
