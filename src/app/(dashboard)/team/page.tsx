'use client';

import { FormEvent, useMemo, useState } from 'react';
import { addDoc, collection, doc, orderBy, query, updateDoc } from 'firebase/firestore';
import { Copy, Loader2, Mail, UserCheck, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCollection, useFirestore, useMemoFirebase, useSession } from '@/firebase';
import { useStudents } from '@/hooks/use-students';
import { normalizeEmail, type TenantInvite, type TenantMember } from '@/lib/auth-config';
import { Student } from '@/lib/types';

export default function TeamPage() {
  const firestore = useFirestore();
  const { activeTenantId, canManageTenant, tenant, user } = useSession();
  const { students, updateStudent } = useStudents();
  const [inviteEmail, setInviteEmail] = useState('');
  const [lastInviteLink, setLastInviteLink] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedInstructorId, setSelectedInstructorId] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const membersRef = useMemoFirebase(
    () => (firestore && activeTenantId ? collection(firestore, 'tenants', activeTenantId, 'members') : null),
    [firestore, activeTenantId]
  );
  const invitesRef = useMemoFirebase(
    () => (firestore && activeTenantId ? collection(firestore, 'tenants', activeTenantId, 'invites') : null),
    [firestore, activeTenantId]
  );
  const invitesQuery = useMemoFirebase(
    () => (invitesRef ? query(invitesRef, orderBy('createdAt', 'desc')) : null),
    [invitesRef]
  );

  const { data: members, isLoading: membersLoading } = useCollection<TenantMember>(membersRef);
  const { data: invites, isLoading: invitesLoading } = useCollection<TenantInvite>(invitesQuery);

  const instructors = useMemo(
    () => (members || []).filter(member => member.role === 'schoolInstructor' && member.status === 'active'),
    [members]
  );

  const handleInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!invitesRef || !activeTenantId || !user) return;

    const email = normalizeEmail(inviteEmail);
    if (!email.includes('@')) return;

    setIsBusy(true);
    try {
      const inviteDoc = await addDoc(invitesRef, {
        email,
        role: 'schoolInstructor',
        status: 'pending',
        tenantId: activeTenantId,
        createdByUid: user.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } satisfies Omit<TenantInvite, 'id'>);
      const origin = window.location.origin;
      const link = `${origin}/login?mode=invite&tenantId=${activeTenantId}&inviteId=${inviteDoc.id}`;
      setLastInviteLink(link);
      await navigator.clipboard?.writeText(link).catch(() => undefined);
      setInviteEmail('');
    } finally {
      setIsBusy(false);
    }
  };

  const handleDisable = async (member: TenantMember) => {
    if (!activeTenantId) return;
    await updateDoc(doc(firestore, 'tenants', activeTenantId, 'members', member.uid), {
      status: 'disabled',
      updatedAt: new Date().toISOString(),
    });
  };

  const handleAssignStudent = async () => {
    if (!selectedStudentId || !selectedInstructorId) return;
    const student = students?.find(item => item.id === selectedStudentId) as Student | undefined;
    if (!student) return;
    const assignedInstructorIds = Array.from(new Set([...(student.assignedInstructorIds || []), selectedInstructorId]));
    await updateStudent({ id: student.id, assignedInstructorIds });
  };

  if (!canManageTenant || !activeTenantId) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">Only school admins can manage instructors.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Team</h1>
        <p className="mt-2 text-sm text-muted-foreground">Invite instructors and assign students in {tenant?.name || 'this workspace'}.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl"><Mail className="h-5 w-5" /> Invite instructor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="flex flex-col gap-3 sm:flex-row" onSubmit={handleInvite}>
              <div className="flex-1 space-y-2">
                <Label htmlFor="inviteEmail">Instructor email</Label>
                <Input id="inviteEmail" type="email" value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} placeholder="instructor@example.com" />
              </div>
              <Button className="mt-auto" disabled={isBusy || !inviteEmail.includes('@')}>
                {isBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create invite
              </Button>
            </form>
            {lastInviteLink && (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <div className="mb-2 font-medium">Invite link copied</div>
                <div className="break-all text-muted-foreground">{lastInviteLink}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl"><UserCheck className="h-5 w-5" /> Assign student</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
              <SelectTrigger><SelectValue placeholder="Choose student" /></SelectTrigger>
              <SelectContent>
                {(students || []).map(student => <SelectItem key={student.id} value={student.id}>{student.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedInstructorId} onValueChange={setSelectedInstructorId}>
              <SelectTrigger><SelectValue placeholder="Choose instructor" /></SelectTrigger>
              <SelectContent>
                {instructors.map(instructor => <SelectItem key={instructor.uid} value={instructor.uid}>{instructor.displayName || instructor.email}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={handleAssignStudent} disabled={!selectedStudentId || !selectedInstructorId}>Assign</Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {membersLoading && <p className="text-sm text-muted-foreground">Loading members...</p>}
          {(members || []).map(member => (
            <div key={member.uid} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <div className="font-medium">{member.displayName || member.email}</div>
                <div className="text-xs text-muted-foreground">{member.email} · {member.role} · {member.status}</div>
              </div>
              {member.role === 'schoolInstructor' && member.status === 'active' && (
                <Button variant="outline" size="sm" onClick={() => handleDisable(member)}>
                  <UserX className="mr-2 h-4 w-4" />
                  Disable
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending invites</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {invitesLoading && <p className="text-sm text-muted-foreground">Loading invites...</p>}
          {(invites || []).filter(invite => invite.status === 'pending').map(invite => {
            const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/login?mode=invite&tenantId=${activeTenantId}&inviteId=${invite.id}`;
            return (
              <div key={invite.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div>
                  <div className="font-medium">{invite.email}</div>
                  <div className="text-xs text-muted-foreground">Pending instructor invite</div>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigator.clipboard?.writeText(link)}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy link
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
