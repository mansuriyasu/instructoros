'use client';

import { useState } from 'react';
import { GitMerge, Loader2 } from 'lucide-react';
import { Student } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface DuplicateMergeDialogProps {
  groups: Student[][];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMerge: (primary: Student, duplicates: Student[]) => Promise<void>;
}

export function DuplicateMergeDialog({ groups, open, onOpenChange, onMerge }: DuplicateMergeDialogProps) {
  const [isMerging, setIsMerging] = useState(false);
  const { toast } = useToast();

  const mergeAll = async () => {
    setIsMerging(true);
    try {
      for (const group of groups) {
        const [primary, ...duplicates] = [...group].sort((a, b) =>
          new Date(a.registrationDate || '').getTime() - new Date(b.registrationDate || '').getTime()
        );
        await onMerge(primary, duplicates);
      }
      toast({ title: 'Duplicates merged', description: `${groups.length} duplicate group${groups.length === 1 ? '' : 's'} consolidated successfully.` });
      onOpenChange(false);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Merge stopped', description: error instanceof Error ? error.message : 'One group could not be merged.' });
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={isMerging ? undefined : onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><GitMerge className="h-5 w-5 text-primary" /> Duplicate students</DialogTitle>
          <DialogDescription>
            These records have the same student name. Review each group before merging; the oldest record stays as the primary profile.
            Payments, lessons, evaluations, tags, and instructor assignments are moved to it. Duplicate profiles are kept as deactivated audit records.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {groups.map((group, groupIndex) => {
            const sorted = [...group].sort((a, b) => new Date(a.registrationDate || '').getTime() - new Date(b.registrationDate || '').getTime());
            return (
              <div key={group.map(student => student.id).join('-')} className="rounded-xl border bg-muted/20 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Group {groupIndex + 1}</p>
                <div className="space-y-2">
                  {sorted.map((student, index) => (
                    <div key={student.id} className="flex items-center justify-between gap-3 rounded-lg bg-background px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{student.name || 'Unnamed student'}</p>
                        <p className="truncate text-xs text-muted-foreground">{student.mobileNumber || student.email || student.licenseNumber || 'No contact details'}</p>
                      </div>
                      <span className="shrink-0 text-xs font-medium text-muted-foreground">{index === 0 ? 'Keep' : 'Merge'}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isMerging}>Cancel</Button>
          <Button onClick={mergeAll} disabled={isMerging} className="gap-2">
            {isMerging ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitMerge className="h-4 w-4" />}
            {isMerging ? 'Merging…' : `Merge ${groups.length} group${groups.length === 1 ? '' : 's'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
