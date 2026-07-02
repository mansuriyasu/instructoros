'use client';

import { Suspense } from 'react';
import { StudentForm } from './_components/student-form';
import { useSearchParams } from 'next/navigation';
import { useStudents } from '@/hooks/use-students';
import { Skeleton } from '@/components/ui/skeleton';

function StudentFormPageContent() {
  const searchParams = useSearchParams();
  const studentId = searchParams.get('id');
  const { students, loading } = useStudents();
  
  if (studentId && loading) {
    return <Skeleton className="w-full h-[600px] max-w-2xl mx-auto" />;
  }

  const student = studentId ? students?.find(s => s.id === studentId) : null;
  
  if (studentId && !loading && !student) {
      return <div className="text-center">Student not found.</div>;
  }

  return <StudentForm student={student} />;
}

export default function StudentFormPage() {
    return (
        <Suspense fallback={<Skeleton className="w-full h-[600px] max-w-2xl mx-auto" />}>
            <StudentFormPageContent />
        </Suspense>
    );
}
