'use client';

import { Suspense } from 'react';
import { StudentForm } from './_components/student-form';
import { useSearchParams } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { useDoc, useFirestore, useMemoFirebase, useTenantCollectionPath } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Student } from '@/lib/types';

function StudentFormPageContent() {
  const searchParams = useSearchParams();
  const studentId = searchParams.get('id');
  const firestore = useFirestore();
  const studentsPath = useTenantCollectionPath('students');
  const studentRef = useMemoFirebase(
    () => (firestore && studentsPath && studentId ? doc(firestore, studentsPath, studentId) : null),
    [firestore, studentId, studentsPath]
  );
  const { data: student, isLoading } = useDoc<Student>(studentRef);
  
  if (studentId && isLoading) {
    return <Skeleton className="w-full h-[600px] max-w-2xl mx-auto" />;
  }
  
  if (studentId && !isLoading && !student) {
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
