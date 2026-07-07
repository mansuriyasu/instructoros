'use client';

import * as React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Student } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { UserRound, UsersRound } from 'lucide-react';

interface StudentSelectorProps {
  students: Student[];
  selectedStudent: Student | null;
  onSelectStudent: (student: Student | null) => void;
  isEditing: boolean;
}

export function StudentSelector({
  students,
  selectedStudent,
  onSelectStudent,
  isEditing,
}: StudentSelectorProps) {

  const handleSelectChange = (value: string) => {
    if (value === 'walk-in') {
      onSelectStudent(null);
    } else {
      const student = students.find(s => s.id === value) || null;
      onSelectStudent(student);
    }
  };

  const selectedValue = selectedStudent ? selectedStudent.id : 'walk-in';

  return (
    <Card className="rounded-2xl border bg-card shadow-sm">
      <CardContent className="grid gap-3 p-3 sm:grid-cols-[1fr_auto] sm:items-center sm:p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F4C430]/15 text-[#9A7400]">
            {selectedStudent ? <UserRound className="h-5 w-5" /> : <UsersRound className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {isEditing ? 'Bill Customer' : 'Customer'}
            </p>
            <p className="truncate text-base font-semibold">
              {selectedStudent?.name || 'Walk-in Customer'}
            </p>
          </div>
        </div>
        <Select 
            value={selectedValue} 
            onValueChange={handleSelectChange}
            disabled={isEditing}
        >
          <SelectTrigger className="h-11 w-full rounded-xl sm:w-72">
            <SelectValue placeholder="Select a student..." />
          </SelectTrigger>
          <SelectContent>
             <SelectItem value="walk-in">
                Walk-in Customer
              </SelectItem>
            {students.map((student) => (
              <SelectItem key={student.id} value={student.id}>
                {student.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
      {selectedStudent && !selectedStudent.mobileNumber?.trim() && (
        <div className="border-t bg-amber-50/50 px-4 py-3 text-sm text-amber-900 rounded-b-2xl">
          <strong>Missing Phone Number:</strong> This student has no phone number on file. WhatsApp messages cannot be opened. You can update this in their profile.
        </div>
      )}
    </Card>
  );
}
