'use client';
import { useOffline } from '@/components/offline/offline-provider';
import { Button } from '@/components/ui/button';
export default function OfflineAccessPage() {
  const offline = useOffline();
  if (!offline) return null;
  return <section className="mx-auto w-full max-w-4xl space-y-4 pb-24">
    <h1 className="text-2xl font-bold">Offline access</h1>
    <p>Save active and booked students and seven days of lessons on this phone. Add lesson notes, practice evaluations and student drafts without a connection.</p>
    {!offline.enabled ? <div className="space-y-3 rounded-xl border bg-card p-4"><p className="text-sm">Enable only on your own trusted phone. Student names, addresses, phone numbers and pending drafts will remain on this device until logout or removal. Refresh at least every seven days to keep adding offline drafts. Saved entries remain until synced or removed.</p><Button disabled={offline.busy || !offline.online} onClick={() => void offline.enable()}>{offline.busy ? 'Downloading…' : 'Enable on this trusted phone'}</Button></div> : <div className="flex flex-wrap gap-2"><Button disabled={offline.busy || !offline.online} onClick={() => void offline.download()}>Download latest & sync</Button><Button variant="outline" asChild><a href="/offline.html">Open saved workspace</a></Button></div>}
    {offline.message && <p role="status" className="rounded-xl bg-secondary p-3 text-sm">{offline.message}</p>}
    {offline.enabled && <iframe src="/offline.html" title="Saved students, lessons and pending drafts" className="h-[75dvh] min-h-[500px] w-full rounded-xl border" />}
    <p className="text-sm text-muted-foreground">Saved data refreshes automatically once every 24 hours while open. Tap Download latest & sync before leaving coverage. Uploads run while InstructorOS is open with internet. Entries say “Synced” only after the server confirms them. Conflicts stay saved for review. Payments, booking changes, OTP and customer messages remain online-only.</p>
  </section>;
}
