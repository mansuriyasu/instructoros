'use client';

import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import { collection, doc, orderBy, query, updateDoc } from 'firebase/firestore';
import { Copy, Loader2, Mail, RotateCcw, UserCheck, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCollection, useFirestore, useMemoFirebase, useSession } from '@/firebase';
import { useStudents } from '@/hooks/use-students';
import { normalizeEmail, type TenantInvite, type TenantMember } from '@/lib/auth-config';
import { Student } from '@/lib/types';
import { PLAN_DETAILS } from '@/lib/billing';

export default function TeamPage() {
  const firestore = useFirestore();
  const { activeTenantId, canManageTenant, tenant, user } = useSession();
  const { students, updateStudent } = useStudents();
  const [inviteEmail, setInviteEmail] = useState('');
  const [lastInviteLink, setLastInviteLink] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedInstructorId, setSelectedInstructorId] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

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

  const activeMembers = useMemo(
    () => (members || []).filter(member => member.status === 'active'),
    [members]
  );
  const removedMembers = useMemo(
    () => (members || []).filter(member => member.status !== 'active'),
    [members]
  );
  const instructors = useMemo(
    () => activeMembers.filter(member => member.role === 'schoolInstructor'),
    [activeMembers]
  );
  const pendingInvites = useMemo(
    () => {
      const activeEmails = new Set(activeMembers.map(member => normalizeEmail(member.email)));
      return (invites || []).filter(invite => invite.status === 'pending' && !activeEmails.has(normalizeEmail(invite.email)));
    },
    [activeMembers, invites]
  );
  const isSchoolWorkspace = tenant?.type === 'school';
  const savedSeatLimit = Number(tenant?.seatLimit || 0);
  const seatLimit = isSchoolWorkspace
    ? Math.max(PLAN_DETAILS.school.includedSeats, savedSeatLimit)
    : PLAN_DETAILS.instructor.includedSeats;
  const usedSeats = activeMembers.length + pendingInvites.length;
  const hasSeatAvailable = isSchoolWorkspace && usedSeats < seatLimit;

  const handleInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeTenantId || !user) return;
    if (!isSchoolWorkspace) {
      setError('Team invites are only available for school workspaces.');
      return;
    }
    if (!hasSeatAvailable) {
      setError(`Seat limit reached: ${usedSeats} of ${seatLimit} seats are already active or invited.`);
      return;
    }

    const email = normalizeEmail(inviteEmail);
    if (!email.includes('@')) return;

    setError('');
    setMessage('');

    const existingMember = (members || []).find(member => normalizeEmail(member.email) === email);
    if (existingMember?.status === 'active') {
      setError(`${existingMember.displayName || existingMember.email} is already an active team member.`);
      return;
    }

    const existingInvite = pendingInvites.find(invite => normalizeEmail(invite.email) === email);
    if (existingInvite) {
      const origin = window.location.origin;
      const link = `${origin}/login?mode=invite&tenantId=${activeTenantId}&inviteId=${existingInvite.id}`;
      setLastInviteLink(link);
      await navigator.clipboard?.writeText(link).catch(() => undefined);
      setMessage('This email already has a pending invite. I copied the existing invite link.');
      setInviteEmail('');
      return;
    }

    setIsBusy(true);
    try {
      const response = await fetch('/api/team/invites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify({ tenantId: activeTenantId, email }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.inviteId) {
        throw new Error(result.error || 'Could not create invite.');
      }
      const origin = window.location.origin;
      const link = `${origin}/login?mode=invite&tenantId=${activeTenantId}&inviteId=${result.inviteId}`;
      setLastInviteLink(link);
      await navigator.clipboard?.writeText(link).catch(() => undefined);
      setInviteEmail('');
      setMessage(result.existing ? 'This email already has a pending invite. I copied the existing invite link.' : 'Invite created and copied.');
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : 'Could not create invite.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleDisable = async (member: TenantMember) => {
    if (!activeTenantId) return;
    setError('');
    setMessage('');
    setIsBusy(true);

    try {
      await updateDoc(doc(firestore, 'tenants', activeTenantId, 'members', member.uid), {
        status: 'disabled',
        disabledAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const assignedStudents = (students || []).filter(student => (student.assignedInstructorIds || []).includes(member.uid));
      for (const student of assignedStudents) {
        await updateStudent({
          id: student.id,
          assignedInstructorIds: (student.assignedInstructorIds || []).filter(uid => uid !== member.uid),
        });
      }

      setMessage(`${member.displayName || member.email} was removed from active team and unassigned from ${assignedStudents.length} student(s).`);
    } catch (disableError) {
      setError(disableError instanceof Error ? disableError.message : 'Could not remove this team member.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleReactivate = async (member: TenantMember) => {
    if (!activeTenantId) return;
    setError('');
    setMessage('');
    await updateDoc(doc(firestore, 'tenants', activeTenantId, 'members', member.uid), {
      status: 'active',
      updatedAt: new Date().toISOString(),
    });
    setMessage(`${member.displayName || member.email} is active again.`);
  };

  const handleRevokeInvite = async (invite: TenantInvite) => {
    if (!activeTenantId) return;
    setError('');
    setMessage('');
    await updateDoc(doc(firestore, 'tenants', activeTenantId, 'invites', invite.id), {
      status: 'revoked',
      updatedAt: new Date().toISOString(),
    });
    setMessage(`Invite for ${invite.email} was revoked.`);
  };

  const handleAssignStudent = async () => {
    if (!selectedStudentId || !selectedInstructorId) return;
    const student = students?.find(item => item.id === selectedStudentId) as Student | undefined;
    if (!student) return;
    const assignedInstructorIds = Array.from(new Set([...(student.assignedInstructorIds || []), selectedInstructorId]));
    await updateStudent({ id: student.id, assignedInstructorIds });
    setMessage('Student assignment updated.');
  };

  if (!canManageTenant || !activeTenantId || !isSchoolWorkspace) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">Team management is available for school workspaces.</p>
        </CardContent>
      </Card>
    );
  }

  if (tenant && tenant.type !== 'school') {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="font-semibold">Team management is for school workspaces.</p>
          <p className="mt-2 text-sm text-muted-foreground">Individual instructor accounts do not need team seats or instructor invites.</p>
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

      {message && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-900">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-lg border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold">School seats</p>
          <p className="text-sm text-muted-foreground">{usedSeats} of {seatLimit} user seats are active or invited.</p>
          {savedSeatLimit > 0 && savedSeatLimit < PLAN_DETAILS.school.includedSeats && (
            <p className="mt-1 text-xs font-medium text-amber-700">
              This school includes 10 seats. The old saved limit was {savedSeatLimit}, so InstructorOS is using 10 here.
            </p>
          )}
        </div>
        <Button asChild variant="outline" className="rounded-lg">
          <Link href="/app/billing">Manage seats</Link>
        </Button>
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
                <Input id="inviteEmail" type="email" value={inviteEmail} onChange={event => setInviteEmail(normalizeEmail(event.target.value))} placeholder="instructor@example.com" />
              </div>
              <Button className="mt-auto" disabled={isBusy || !inviteEmail.includes('@') || !hasSeatAvailable}>
                {isBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create invite
              </Button>
            </form>
            {!hasSeatAvailable && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
                {usedSeats >= seatLimit
                  ? `Seat limit reached: ${usedSeats} of ${seatLimit} seats are already active or invited.`
                  : 'Team invites are only available for school workspaces.'}
              </div>
            )}
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
          {activeMembers.length === 0 && !membersLoading && (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No active team members yet.</p>
          )}
          {activeMembers.map(member => (
            <div key={member.uid} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <div className="font-medium">{member.displayName || member.email}</div>
                <div className="text-xs text-muted-foreground">{member.email} · {member.role}</div>
              </div>
              {member.role === 'schoolInstructor' && (
                <Button variant="outline" size="sm" onClick={() => handleDisable(member)} disabled={isBusy}>
                  <UserX className="mr-2 h-4 w-4" />
                  Remove
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
          {pendingInvites.length === 0 && !invitesLoading && (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No pending invites.</p>
          )}
          {pendingInvites.map(invite => {
            const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/login?mode=invite&tenantId=${activeTenantId}&inviteId=${invite.id}`;
            return (
              <div key={invite.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div>
                  <div className="font-medium">{invite.email}</div>
                  <div className="text-xs text-muted-foreground">Pending instructor invite</div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => navigator.clipboard?.writeText(link)}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleRevokeInvite(invite)}>
                    Revoke
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {removedMembers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Removed members</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {removedMembers.map(member => (
              <div key={member.uid} className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
                <div>
                  <div className="font-medium">{member.displayName || member.email}</div>
                  <div className="text-xs text-muted-foreground">{member.email} · {member.role} · removed</div>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleReactivate(member)}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reactivate
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
