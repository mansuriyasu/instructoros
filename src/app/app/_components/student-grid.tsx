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

export type StudentStatusFilter = StudentStatus | 'all' | 'current';

export function StudentGrid() {
  const { students, loading, updateStudent, deleteStudent } = useStudents();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StudentStatusFilter>('current');
  const [licenseTypeFilter, setLicenseTypeFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const filteredStudents = useMemo(() => {
    let studentList = students || [];
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
      new Set((students || []).flatMap(student => Array.isArray(student.tags) ? student.tags.filter(t => t && typeof t === 'string') : []))
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
  
  const handleDelete = async (studentId: string) => {
    await deleteStudent(studentId);
  };

  return (
    <div className="h-full flex flex-col">
       <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Students</h1>
        </div>
        <StudentGridActions />
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
        onDelete={handleDelete}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
