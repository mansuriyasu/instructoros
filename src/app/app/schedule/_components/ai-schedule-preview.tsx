'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScheduleProposal } from '@/lib/types';
import { useSession } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { CalendarEvent } from '@/lib/types';
import { useEvents } from '@/hooks/use-events';
import { useServices } from '@/hooks/use-services';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AiSchedulePreviewProps {
  currentDate: Date;
  selectedInstructorId?: string;
  onClose: () => void;
}

export function AiSchedulePreview({ currentDate, selectedInstructorId, onClose }: AiSchedulePreviewProps) {
  const { tenant } = useSession();
  const { toast } = useToast();
  const { addEvent } = useEvents();
  const { services } = useServices();

  const [loading, setLoading] = useState(false);
  const [proposal, setProposal] = useState<ScheduleProposal | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [serviceId, setServiceId] = useState('');

  const selectedService = services.find(service => service.id === serviceId) || services[0];

  const fetchProposal = async () => {
    if (!tenant?.id || !selectedInstructorId || selectedInstructorId === 'all') {
      toast({ variant: 'destructive', title: 'Select an instructor first.' });
      return;
    }
    if (!selectedService) {
      toast({ variant: 'destructive', title: 'Add a service first.', description: 'AI scheduling needs the real lesson duration and service.' });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/schedule/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tenant.id,
          instructorId: selectedInstructorId,
          serviceId: selectedService.id,
          date: format(currentDate, 'yyyy-MM-dd')
        })
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      if (!data.proposal) {
        toast({ title: 'No students available', description: data.error });
        onClose();
        return;
      }
      setProposal(data.proposal);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed to generate schedule', description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!proposal || !tenant?.id || !selectedInstructorId) return;
    setConfirming(true);

    try {
      // Create the same event shape used by manual scheduling, including the selected service.
      for (const candidate of proposal.candidates as any[]) {
        const eventToCreate: Omit<CalendarEvent, 'id'> = {
          title: `Lesson - ${candidate.studentName}`,
          start: candidate.suggestedStartTime,
          end: candidate.suggestedEndTime,
          studentId: candidate.studentId,
          studentName: candidate.studentName,
          studentAddress: candidate.studentAddress,
          services: [{
            id: candidate.serviceId,
            name: candidate.serviceName,
            price: candidate.servicePrice,
            cost: candidate.serviceCost,
            discount: candidate.serviceDiscount,
          }],
          instructorId: selectedInstructorId,
          lessonStatus: 'scheduled',
          paymentStatus: 'unpaid',
          paymentMethod: 'Unpaid',
        };
        await addEvent(eventToCreate as any);
      }
      toast({ title: 'Schedule Applied', description: `Added ${proposal.candidates.length} events to the calendar.` });
      onClose();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed to save', description: e.message });
    } finally {
      setConfirming(false);
    }
  };

  const removeCandidate = (studentId: string) => {
    if (!proposal) return;
    setProposal({
      ...proposal,
      candidates: proposal.candidates.filter(c => c.studentId !== studentId)
    });
  };

    return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-background rounded-2xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Auto-Schedule Day (AI)</DialogTitle>
        </DialogHeader>

        {!proposal ? (
          <div className="py-8 text-center space-y-4">
            <p className="text-muted-foreground text-sm">
              We will generate a deterministic schedule considering travel time and student availability for {format(currentDate, 'MMM do, yyyy')}.
            </p>
            <div className="space-y-2 text-left">
              <p className="text-sm font-semibold">Lesson service</p>
              <Select value={serviceId || services[0]?.id || ''} onValueChange={setServiceId}>
                <SelectTrigger><SelectValue placeholder="Choose a service" /></SelectTrigger>
                <SelectContent>
                  {services.map(service => <SelectItem key={service.id} value={service.id}>{service.name} · {service.duration || 60} min</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={fetchProposal} disabled={loading || !selectedService} className="w-full h-12 bg-indigo-600 text-white hover:bg-indigo-700 font-semibold">
              {loading ? 'Analyzing Availability & Routes...' : 'Generate Schedule'}
            </Button>
          </div>
        ) : (
          <div className="space-y-6 pt-4">
            <div className="flex gap-4 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
              <div className="flex-1">
                <p className="text-sm font-semibold text-indigo-900">Total Travel</p>
                <p className="text-2xl font-bold text-indigo-700">{proposal.totalTravelMinutes} <span className="text-sm font-medium">min</span></p>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-indigo-900">Total Lessons</p>
                <p className="text-2xl font-bold text-indigo-700">{proposal.candidates.length}</p>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold">Proposed Sequence</h3>
              {proposal.candidates.map((c: any, index) => (
                <div key={index} className="flex gap-4 p-3 border rounded-xl hover:bg-muted/50 transition-colors">
                  <div className="flex flex-col items-center justify-center shrink-0 w-16 text-center border-r pr-4">
                    <span className="text-xs font-semibold uppercase text-muted-foreground">Start</span>
                    <span className="font-bold text-sm">{format(new Date(c.suggestedStartTime), 'HH:mm')}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{c.studentName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {c.serviceName} · {c.studentAddress}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {c.travelMinutes > 0 ? `+${c.travelMinutes}m travel (+${c.bufferMinutes}m buffer)` : 'No travel buffer required.'}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeCandidate(c.studentId)} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                    Remove
                  </Button>
                </div>
              ))}
              {proposal.candidates.length === 0 && (
                <p className="text-sm text-muted-foreground italic">No students remaining in the proposal.</p>
              )}
            </div>

            {proposal.exclusions.length > 0 && (
              <div className="space-y-2 mt-6 pt-6 border-t border-border/60">
                <h3 className="font-semibold text-muted-foreground text-sm">Excluded Students</h3>
                <ul className="text-sm space-y-1">
                  {proposal.exclusions.map((ex, i) => (
                    <li key={i} className="text-muted-foreground">
                      <span className="font-medium text-foreground">{ex.studentId}</span>: {ex.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-border/60">
              <Button variant="ghost" onClick={fetchProposal} disabled={confirming}>
                Try Another Plan
              </Button>
              <Button onClick={handleConfirm} disabled={confirming || proposal.candidates.length === 0} className="bg-indigo-600 hover:bg-indigo-700">
                {confirming ? 'Applying...' : 'Confirm & Apply Schedule'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
