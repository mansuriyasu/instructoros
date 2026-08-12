'use client';

import { useEffect, useState, useMemo } from 'react';
import { useStudents } from '@/hooks/use-students';
import { Student, StudentStatus } from '@/lib/types';
import { StudentCard } from './student-card';
import { StudentGridHeader } from './student-grid-header';
import { StudentDetailsDialog } from './student-details-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { StudentGridActions } from './student-grid-actions';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { StudentIntakeLinkDialog } from './student-intake-link-dialog';
import { DuplicateMergeDialog } from './duplicate-merge-dialog';
import { GitMerge } from 'lucide-react';
import { useSession } from '@/firebase';
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

export function StudentGrid() {
  const { students, loading, updateStudent, deleteStudent, mergeStudentGroups } = useStudents();
  const { canManageTenant } = useSession();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StudentStatusFilter>('current');
  const [licenseTypeFilter, setLicenseTypeFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isDuplicateMergeOpen, setIsDuplicateMergeOpen] = useState(false);
  const [studentPendingDelete, setStudentPendingDelete] = useState<Student | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const filteredStudents = useMemo(() => {
    let studentList = (students || []).filter(student => !isMergedAuditRecord(student));
    if (searchTerm.trim() !== '') {
        return studentList.filter(student => 
            (student.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (student.licenseNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (student.mobileNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (Array.isArray(student.tags) ? student.tags : []).some(tag => tag && typeof tag === 'string' && tag.toLowerCase().includes(searchTerm.toLowerCase()))
        ).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }
    
    return studentList.filter(student => {
        if (statusFilter === 'current' && !['active', 'booked'].includes(student.status)) return false;
        if (statusFilter !== 'all' && statusFilter !== 'current' && student.status !== statusFilter) return false;
        if (licenseTypeFilter !== 'all' && student.licenseType !== licenseTypeFilter) return false;
        if (tagFilter !== 'all' && !(Array.isArray(student.tags) ? student.tags : []).some(tag => tag && typeof tag === 'string' && tag.toLowerCase() === tagFilter.toLowerCase())) return false;
        return true;
      }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      
  }, [students, searchTerm, statusFilter, licenseTypeFilter, tagFilter]);

  const availableTags = useMemo(() => {
    return Array.from(
      new Set((students || []).filter(student => !isMergedAuditRecord(student)).flatMap(student => Array.isArray(student.tags) ? student.tags.filter(t => t && typeof t === 'string') : []))
    ).sort((a, b) => a.localeCompare(b));
  }, [students]);

  useEffect(() => {
    if (!selectedStudent) return;
    const updatedStudent = students?.find(student => student.id === selectedStudent.id);
    if (updatedStudent) {
      setSelectedStudent(updatedStudent);
    }
  }, [students, selectedStudent?.id]);

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
    <div className="h-full flex flex-col">
       <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Students</h1>
        </div>
        <div className="flex items-center gap-2">
          <StudentIntakeLinkDialog />
          {canManageTenant && duplicateGroups.length > 0 && (
            <Button variant="outline" onClick={() => setIsDuplicateMergeOpen(true)} className="h-10 gap-2 px-3">
              <GitMerge className="h-4 w-4" />
              <span className="hidden sm:inline">Merge duplicates{duplicateGroups.length > 0 ? ` (${duplicateGroups.length})` : ''}</span>
              <span className="sm:hidden">Merge{duplicateGroups.length > 0 ? ` (${duplicateGroups.length})` : ''}</span>
            </Button>
          )}
          <StudentGridActions />
        </div>
      </div>

      <div className="mt-6 flex-1 pb-24">
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
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : filteredStudents.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredStudents.map((student) => (
              <StudentCard
                key={student.id}
                student={student}
                onClick={() => handleCardClick(student)}
              />
            ))}
          </div>
        ) : (
            <div className="text-center py-16 border-2 border-dashed rounded-lg">
                <h3 className="text-lg font-semibold">No students found</h3>
                <p className="text-muted-foreground mt-1">{searchTerm ? 'Your search returned no results.' : 'Try adjusting your filters or adding a new student.'}</p>
            </div>
        )}
      </div>

      <Button
        onClick={handleAddNew}
        className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg"
        size="icon"
      >
        <Plus className="h-6 w-6" />
        <span className="sr-only">Add Student</span>
      </Button>

      <StudentDetailsDialog
        isOpen={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        student={selectedStudent}
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
