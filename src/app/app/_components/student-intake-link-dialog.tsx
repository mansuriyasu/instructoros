'use client';

import { useState } from 'react';
import { Check, ClipboardCopy, Link2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useSession } from '@/firebase';
import { getAuthenticatedHeaders } from '@/lib/authenticated-fetch';
import { useToast } from '@/hooks/use-toast';

export function StudentIntakeLinkDialog() {
  const { activeTenantId, role } = useSession();
  const { toast } = useToast();
  const [open, setOpen] = useState(false); const [loading, setLoading] = useState(false); const [link, setLink] = useState('');
  const canCreate = role === 'schoolAdmin' || role === 'soloInstructor' || role === 'mainAdmin';
  if (!canCreate) return null;
  const createLink = async () => {
    if (!activeTenantId) return;
    setLoading(true);
    try { const response = await fetch('/api/student-intake', { method: 'POST', headers: { ...(await getAuthenticatedHeaders()), 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId: activeTenantId }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setLink(`${window.location.origin}/student-intake/${data.token}`); }
    catch (error) { toast({ variant: 'destructive', title: 'Could not create form link', description: error instanceof Error ? error.message : 'Please try again.' }); }
    finally { setLoading(false); }
  };
  const copy = async () => { await navigator.clipboard.writeText(link); toast({ title: 'Link copied', description: 'Send it to the student by email or WhatsApp.' }); };
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="outline" className="gap-2"><Link2 className="h-4 w-4" />Student form link</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Student self-registration</DialogTitle><DialogDescription>Create a secure form link that a student can complete on their phone. The link expires in 30 days.</DialogDescription></DialogHeader>{link ? <div className="space-y-3"><p className="text-sm font-semibold">Share this link</p><div className="break-all rounded-lg border bg-muted p-3 text-sm">{link}</div><Button onClick={copy} className="w-full gap-2"><ClipboardCopy className="h-4 w-4" />Copy link</Button><p className="text-xs text-muted-foreground">Each submission is added to your normal Students list for review.</p></div> : <Button onClick={createLink} disabled={loading || !activeTenantId} className="h-12 gap-2">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}{loading ? 'Creating link...' : 'Create form link'}</Button>}<DialogFooter>{link && <Button variant="ghost" onClick={() => setLink('')} className="gap-2"><Check className="h-4 w-4" />Create another link</Button>}</DialogFooter></DialogContent></Dialog>;
}
