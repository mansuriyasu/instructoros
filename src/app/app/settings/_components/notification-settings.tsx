'use client';
import { useEffect, useState } from 'react';
import { Bell, BellOff, Send, Smartphone, Share, PlusSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { defaults, categories, type Preferences } from '@/lib/notifications';
import { notificationRequest, registerPush, disablePush, platform, standalone, installationId } from '@/firebase/messaging';

const labels = { registrations: 'New registrations', availability: 'Availability updates', lessons: 'Upcoming lessons', schedule: 'Schedule changes', payments: 'Payments', roadTests: 'Road tests' };
type InstallEvent = Event & { prompt: () => Promise<void> };
export function NotificationSettings() {
  const [prefs, setPrefs] = useState<Preferences>(defaults);
  const [status, setStatus] = useState('Checking this device...');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [needsInstall, setNeedsInstall] = useState(false);
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const install = (event: Event) => { event.preventDefault(); setInstallEvent(event as InstallEvent); };
    window.addEventListener('beforeinstallprompt', install);
    const ios = platform() === 'ios' && !standalone(); setNeedsInstall(ios);
    void notificationRequest('?settings=1').then(result => {
      setPrefs(result.preferences);
      const supported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
      const registered = supported && Notification.permission === 'granted' && result.devices.some((d: {installationId: string}) => d.installationId === installationId());
      setEnabled(registered);
      setReady(result.configured && supported && !ios && Notification.permission !== 'denied');
      setStatus(ios ? 'Add InstructorOS to your Home Screen first.' : !supported ? 'Notifications are unavailable in this browser.' : Notification.permission === 'denied' ? 'Notifications are blocked. Allow InstructorOS in your browser or device notification settings.' : !result.configured ? 'Mobile notifications are awaiting setup.' : registered ? 'Enabled on this device' : 'Not enabled on this device');
    }).catch(e => setError(e.message));
    return () => window.removeEventListener('beforeinstallprompt', install);
  }, []);
  async function save(next: Preferences) {
    await notificationRequest('', { action: 'preferences', ...next }); setPrefs(next);
  }
  async function run(action: () => Promise<void>) { setBusy(true); setError(''); try { await action(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  function enable() {
    // Request permission directly from the tap, before asynchronous registration.
    const permission = Notification.requestPermission();
    void run(async () => {
      if (await permission !== 'granted') { setStatus('Notifications are blocked in browser or device settings.'); setReady(false); return; }
      await registerPush(); await save({ ...prefs, pushEnabled: true }); setEnabled(true); setStatus('Enabled on this device');
    });
  }
  return <section className="max-w-2xl space-y-5 py-3">
    <div className="flex items-center gap-3"><Smartphone className="h-6 w-6" /><h2 className="text-lg font-semibold">Mobile notifications</h2></div>
    <p role="status" className="text-sm text-muted-foreground">{status}</p>
    {needsInstall && <ol className="list-decimal space-y-2 pl-5 text-sm"><li>Open InstructorOS in Safari.</li><li>Tap <Share className="inline h-4 w-4" aria-label="Share" /> Share, then <PlusSquare className="inline h-4 w-4" /> Add to Home Screen.</li><li>Open InstructorOS from your Home Screen and return here.</li></ol>}
    {installEvent && <Button variant="outline" onClick={() => void installEvent.prompt()}><PlusSquare className="mr-2 h-4 w-4" />Install InstructorOS</Button>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <div className="flex flex-wrap gap-2">{!enabled ? <Button disabled={!ready || busy} onClick={enable}><Bell className="mr-2 h-4 w-4" />Enable notifications</Button> : <><Button disabled={busy || !prefs.pushEnabled} onClick={() => void run(async () => { await notificationRequest('', { action: 'test' }); setStatus('Test notification queued for your enabled devices.'); })}><Send className="mr-2 h-4 w-4" />Send test notification</Button><Button variant="outline" disabled={busy} onClick={() => void run(async () => { await disablePush(); setEnabled(false); setStatus('Disabled on this device'); })}><BellOff className="mr-2 h-4 w-4" />Disable this device</Button></>}</div>
    <div className="divide-y border-y">
      <label className="flex items-center justify-between gap-4 py-4 text-sm font-semibold">Push on all my devices<Switch checked={prefs.pushEnabled} disabled={busy} onCheckedChange={value => void run(() => save({ ...prefs, pushEnabled: value }))} /></label>
      {categories.map(category => <label key={category} className="flex items-center justify-between gap-4 py-4 text-sm">{labels[category]}<Switch checked={prefs.categories[category]} disabled={busy} onCheckedChange={value => void run(() => save({ ...prefs, categories: { ...prefs.categories, [category]: value } }))} /></label>)}
    </div>
    <label className="flex flex-wrap items-center justify-between gap-3 text-sm">Lesson reminder<select className="rounded-md border bg-background p-2" value={prefs.lessonMinutes} disabled={busy} onChange={e => void run(() => save({ ...prefs, lessonMinutes: Number(e.target.value) as Preferences['lessonMinutes'] }))}><option value="0">Off</option><option value="15">15 minutes before</option><option value="30">30 minutes before</option><option value="60">60 minutes before</option></select></label>
  </section>;
}
