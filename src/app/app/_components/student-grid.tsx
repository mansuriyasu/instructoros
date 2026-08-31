'use client';

import { useEffect, useState, useMemo } from 'react';
import { addMonths, isSameDay, startOfDay } from 'date-fns';
import { useStudents } from '@/hooks/use-students';
import { useEvents } from '@/hooks/use-events';
import { CalendarEvent, Student, StudentStatus } from '@/lib/types';
import { StudentCard } from './student-card';
import { StudentGridHeader } from './student-grid-header';
import { StudentDetailsDialog } from './student-details-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { StudentGridActions } from './student-grid-actions';
import { Button } from '@/components/ui/button';
import { CalendarDays, GitMerge, Menu, Plus } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { StudentIntakeLinkDialog } from './student-intake-link-dialog';
import { DuplicateMergeDialog } from './duplicate-merge-dialog';
import { useDoc, useFirestore, useMemoFirebase, useSession, useTenantCollectionPath } from '@/firebase';
import { doc } from 'firebase/firestore';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export type StudentStatusFilter = StudentStatus | 'all' | 'current';

type StudentRecord = Student & { mergedIntoStudentId?: string; mergedAt?: string };

function isMergedAuditRecord(student: Student) {
  return Boolean((student as StudentRecord).mergedIntoStudentId);
}

function ensureDialogStudent(student: Student | null): Student | null {
  if (!student) return null;

  return {
    ...student,
    name: student.name || '',
    mobileNumber: student.mobileNumber || '',
    email: student.email || '',
    address: student.address || '',
    birthdate: student.birthdate || '',
    licenseNumber: student.licenseNumber || '',
    licenseExpiry: student.licenseExpiry || '',
    licenseType: student.licenseType || 'G2',
    status: student.status || 'active',
    comments: student.comments || '',
    registrationDate: student.registrationDate || new Date(0).toISOString(),
    tags: Array.isArray(student.tags) ? student.tags : [],
    assignedInstructorIds: Array.isArray(student.assignedInstructorIds) ? student.assignedInstructorIds : [],
  };
}

export function StudentGrid() {
  const { students, loading, updateStudent, deleteStudent, mergeStudentGroups } = useStudents();
  const firestore = useFirestore();
  const studentsPath = useTenantCollectionPath('students');
  const currentTime = useMemo(() => new Date(), []);
  const eventRangeStart = useMemo(() => startOfDay(new Date()), []);
  const eventRangeEnd = useMemo(() => addMonths(eventRangeStart, 18), [eventRangeStart]);
  const { events } = useEvents(eventRangeStart, eventRangeEnd);
  const { canManageTenant } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const studentIdParam = searchParams.get('studentId');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StudentStatusFilter>('current');
  const [licenseTypeFilter, setLicenseTypeFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [quickFilter, setQuickFilter] = useState<'all' | 'today'>('today');

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isDuplicateMergeOpen, setIsDuplicateMergeOpen] = useState(false);
  const [studentPendingDelete, setStudentPendingDelete] = useState<Student | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const selectedStudentRef = useMemoFirebase(
    () => (
      firestore && studentsPath && selectedStudent?.id && isDetailsOpen
        ? doc(firestore, studentsPath, selectedStudent.id)
        : null
    ),
    [firestore, isDetailsOpen, selectedStudent?.id, studentsPath]
  );
  const { data: fullSelectedStudent } = useDoc<Student>(selectedStudentRef);
  const dialogStudent = ensureDialogStudent(fullSelectedStudent || selectedStudent);

  const duplicateGroups = useMemo(() => {
    const groups = new Map<string, Student[]>();
    (students || []).forEach(student => {
      if (isMergedAuditRecord(student)) return;
      const name = (student.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
      if (!name) return;
      const key = name;
      groups.set(key, [...(groups.get(key) || []), student]);
    });
    return [...groups.values()].filter(group => group.length > 1);
  }, [students]);

  const todayStudentIds = useMemo(() => {
    const ids = new Set<string>();
    events.forEach((event) => {
      if (!event.studentId || event.lessonStatus === 'cancelled') return;
      if (isSameDay(new Date(event.start), eventRangeStart)) {
        ids.add(event.studentId);
      }
    });
    return ids;
  }, [events, eventRangeStart]);

  const nextLessonByStudentId = useMemo(() => {
    const map = new Map<string, CalendarEvent>();
    const sortedEvents = [...events]
      .filter(event => event.studentId && event.lessonStatus !== 'cancelled' && new Date(event.start) >= currentTime)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    sortedEvents.forEach((event) => {
      if (!event.studentId || map.has(event.studentId)) return;
      map.set(event.studentId, event);
    });
    return map;
  }, [events, currentTime]);

  const filteredStudents = useMemo(() => {
    let studentList = (students || []).filter(student => !isMergedAuditRecord(student));
    if (searchTerm.trim() !== '') {
        studentList = studentList.filter(student =>
            (student.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (student.licenseNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (student.mobileNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (Array.isArray(student.tags) ? student.tags : []).some(tag => tag && typeof tag === 'string' && tag.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    } else {
      studentList = studentList.filter(student => {
        if (statusFilter === 'current' && !['active', 'booked'].includes(student.status)) return false;
        if (statusFilter !== 'all' && statusFilter !== 'current' && student.status !== statusFilter) return false;
        if (licenseTypeFilter !== 'all' && student.licenseType !== licenseTypeFilter) return false;
        if (tagFilter !== 'all' && !(Array.isArray(student.tags) ? student.tags : []).some(tag => tag && typeof tag === 'string' && tag.toLowerCase() === tagFilter.toLowerCase())) return false;
        return true;
      });
    }

    if (quickFilter === 'today' && searchTerm.trim() === '') {
      studentList = studentList.filter(student => todayStudentIds.has(student.id));
    }

    return studentList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      
  }, [students, searchTerm, statusFilter, licenseTypeFilter, tagFilter, quickFilter, todayStudentIds]);

  const availableTags = useMemo(() => {
    return Array.from(
      new Set((students || []).filter(student => !isMergedAuditRecord(student)).flatMap(student => Array.isArray(student.tags) ? student.tags.filter(t => t && typeof t === 'string') : []))
    ).sort((a, b) => a.localeCompare(b));
  }, [students]);

  useEffect(() => {
    if (!selectedStudent?.id) return;
    const updatedStudent = students?.find(student => student.id === selectedStudent.id);
    if (updatedStudent) {
      setSelectedStudent(updatedStudent);
    }
  }, [students, selectedStudent?.id]);

  useEffect(() => {
    if (!studentIdParam || !students?.length) return;
    const student = students.find(item => item.id === studentIdParam);
    if (!student) return;
    setSelectedStudent(student);
    setIsDetailsOpen(true);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('studentId');
    const nextQuery = params.toString();
    router.replace(`/app/students${nextQuery ? `?${nextQuery}` : ''}`, { scroll: false });
  }, [router, searchParams, studentIdParam, students]);

  const handleCardClick = (student: Student) => {
    setSelectedStudent(student);
    setIsDetailsOpen(true);
  };
  
  const handleEdit = (student: Student) => {
    setIsDetailsOpen(false);
    router.push(`/app/students/form?id=${student.id}`);
  };

  const handleAddNew = () => {
    router.push('/app/students/form');
  }

  const handleScheduleStudent = (studentId: string) => {
    router.push(`/app/schedule?studentId=${encodeURIComponent(studentId)}`);
  };

  const handleStatusChange = async (studentId: string, status: StudentStatus) => {
    const studentToUpdate = students?.find(s => s.id === studentId);
    if (studentToUpdate) {
      await updateStudent({ ...studentToUpdate, status });
      if(selectedStudent?.id === studentId) {
        setSelectedStudent({ ...studentToUpdate, status });
      }
    }
  };
  
  const requestDelete = (studentId: string) => {
    const student = students?.find(item => item.id === studentId);
    if (!student) return;

    setSelectedStudent(null);
    setIsDetailsOpen(false);
    setStudentPendingDelete(student);
    // Let the detail dialog and its dropdown finish closing before opening
    // the separate confirmation dialog. This prevents competing focus locks.
    window.setTimeout(() => setIsDeleteConfirmOpen(true), 0);
  };

  const handleDelete = async () => {
    if (!studentPendingDelete) return;

    setIsDeleting(true);
    try {
      await deleteStudent(studentPendingDelete.id);
      setIsDeleteConfirmOpen(false);
      setStudentPendingDelete(null);
      router.refresh();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 rounded-full md:hidden" aria-label="Open menu">
            <Menu className="h-6 w-6" />
          </Button>
          <h1 className="truncate text-2xl font-bold tracking-tight md:text-2xl">Students</h1>
        </div>
        <div className="flex items-center gap-2">
          <StudentIntakeLinkDialog />
          {canManageTenant && duplicateGroups.length > 0 && (
            <Button
              variant="outline"
              onClick={() => setIsDuplicateMergeOpen(true)}
              className="h-11 w-11 rounded-2xl px-0 sm:w-auto sm:gap-2 sm:px-3"
              aria-label={`Merge ${duplicateGroups.length} duplicate groups`}
            >
              <GitMerge className="h-4 w-4" />
              <span className="hidden sm:inline">Merge duplicates{duplicateGroups.length > 0 ? ` (${duplicateGroups.length})` : ''}</span>
            </Button>
          )}
          <div className="hidden md:block">
            <StudentGridActions />
          </div>
          <Button
            onClick={handleAddNew}
            className="h-11 w-11 shrink-0 rounded-full bg-blue-600 text-white shadow-sm hover:bg-blue-700 md:hidden"
            size="icon"
            aria-label="Add Student"
          >
            <Plus className="h-6 w-6" />
          </Button>
        </div>
      </div>

      <div className="mt-5 flex-1 pb-24">
        <StudentGridHeader
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          licenseTypeFilter={licenseTypeFilter}
          setLicenseTypeFilter={setLicenseTypeFilter}
          tagFilter={tagFilter}
          setTagFilter={setTagFilter}
          availableTags={availableTags}
        />
        <div className="mb-5 grid grid-cols-1 gap-3 sm:max-w-[14rem]">
          <button
            type="button"
            onClick={() => setQuickFilter('today')}
            className={`flex h-14 items-center justify-between rounded-2xl border px-4 text-left shadow-sm transition ${
              quickFilter === 'today' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-border bg-card text-foreground'
            }`}
          >
            <span className="flex items-center gap-2 font-semibold">
              <CalendarDays className="h-5 w-5" />
              Today
            </span>
            <span className="rounded-full bg-blue-600 px-2.5 py-1 text-xs font-bold text-white">
              {todayStudentIds.size}
            </span>
          </button>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-[24px]" />
            ))}
          </div>
        ) : filteredStudents.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-3">
            {filteredStudents.map((student) => (
              <StudentCard
                key={student.id}
                student={student}
                nextLesson={nextLessonByStudentId.get(student.id)}
                onClick={() => handleCardClick(student)}
                onSchedule={() => handleScheduleStudent(student.id)}
              />
            ))}
          </div>
        ) : (
            <div className="text-center py-16 border-2 border-dashed rounded-lg">
                <h3 className="text-lg font-semibold">{quickFilter === 'today' && !searchTerm ? 'No students scheduled today' : 'No students found'}</h3>
                <p className="text-muted-foreground mt-1">{searchTerm ? 'Your search returned no results.' : 'Search to find any student, or use the schedule page for appointments.'}</p>
            </div>
        )}
      </div>

      <Button
        onClick={handleAddNew}
        className="fixed bottom-20 right-4 hidden h-14 w-14 rounded-full shadow-lg md:inline-flex"
        size="icon"
      >
        <Plus className="h-6 w-6" />
        <span className="sr-only">Add Student</span>
      </Button>

      <StudentDetailsDialog
        isOpen={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        student={dialogStudent}
        onEdit={handleEdit}
        onDelete={requestDelete}
        onStatusChange={handleStatusChange}
      />
      <DuplicateMergeDialog
        groups={duplicateGroups}
        open={isDuplicateMergeOpen}
        onOpenChange={setIsDuplicateMergeOpen}
        onMerge={async (groups) => {
          await mergeStudentGroups(groups.map(group => ({
            primaryId: group.primary.id,
            duplicateIds: group.duplicates.map(duplicate => duplicate.id),
          })));
        }}
      />
      <AlertDialog
        open={isDeleteConfirmOpen}
        onOpenChange={(open) => {
          if (!isDeleting) {
            setIsDeleteConfirmOpen(open);
            if (!open) setStudentPendingDelete(null);
          }
        }}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this student?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {studentPendingDelete?.name || 'this student'} and all associated data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} className="rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={async (event) => {
                event.preventDefault();
                try {
                  await handleDelete();
                } catch {
                  setIsDeleteConfirmOpen(false);
                  setStudentPendingDelete(null);
                }
              }}
              className="rounded-full bg-red-600 text-white shadow-md hover:bg-red-700"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
