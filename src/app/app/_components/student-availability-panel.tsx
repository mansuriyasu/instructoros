'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useSession, useFirestore } from '@/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { StudentAvailability } from '@/lib/types';
import { Copy, Link as LinkIcon, RefreshCw, Share2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { getAuthenticatedHeaders } from '@/lib/authenticated-fetch';

export function StudentAvailabilityPanel({ studentId, studentName }: { studentId: string, studentName: string }) {
  const { tenant } = useSession();
  const db = useFirestore();
  const { toast } = useToast();
  const [availability, setAvailability] = useState<StudentAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);

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

  const generateLink = async () => {
    if (!tenant?.id) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/availability/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getAuthenticatedHeaders()) },
        body: JSON.stringify({ tenantId: tenant.id, studentId })
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      const link = `${window.location.origin}/availability/${data.token}`;
      setShareLink(link);
      await navigator.clipboard.writeText(link);
      toast({ title: 'Link generated', description: `${studentName}'s availability link was copied.` });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Failed to generate link', description: e instanceof Error ? e.message : 'Please try again.' });
    } finally {
      setGenerating(false);
    }
  };

  const copyLink = async () => {
    if (!shareLink) return;
    await navigator.clipboard.writeText(shareLink);
    toast({ title: 'Link copied' });
  };

  const shareLinkWithStudent = async () => {
    if (!shareLink) {
      toast({ title: 'Generate the link first', description: 'For security, the raw link is shown only when generated.' });
      return;
    }
    if (navigator.share) {
      await navigator.share({ title: `${studentName} availability`, text: 'Please tell us when you are available for driving lessons.', url: shareLink });
    } else {
      await copyLink();
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground animate-pulse">Loading availability...</div>;
  }

  return (
    <div className="relative z-10 rounded-2xl border border-border/50 bg-muted/30 p-4 mt-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <LinkIcon className="h-4 w-4 text-[#C9A84C]" />
          Student Availability
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={generateLink}
          disabled={generating}
          className="h-7 text-xs border-[#C9A84C]/30 text-[#C9A84C] hover:bg-[#C9A84C]/10"
        >
          {generating ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
          {availability?.tokenEnabled ? 'Regenerate Link' : 'Generate Link'}
        </Button>
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
          {availability.tokenCreatedAt && (
            <p className="text-xs text-muted-foreground">
              Link generated {formatDistanceToNow(new Date(availability.tokenCreatedAt), { addSuffix: true })}
            </p>
          )}
          {availability.weeklyWindows?.length > 0 && (
             <p className="text-xs text-muted-foreground">
               {availability.weeklyWindows.length} weekly windows, {availability.overrides?.length || 0} date overrides.
             </p>
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={copyLink} disabled={!shareLink}>
              <Copy className="mr-1 h-3.5 w-3.5" /> Copy link
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={shareLinkWithStudent} disabled={!shareLink}>
              <Share2 className="mr-1 h-3.5 w-3.5" /> Share
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
