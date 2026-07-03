"use client";

import { Student } from '@/lib/types';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking, useUser, useSession, useTenantCollectionPath } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';

export function useStudents() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { role } = useSession();
  const studentsPath = useTenantCollectionPath('students');

  const studentsCollectionRef = useMemoFirebase(
    () => (firestore && user && studentsPath ? collection(firestore, studentsPath) : null),
    [firestore, user, studentsPath]
  );

  const studentsQuery = useMemoFirebase(
    () => {
      if (!studentsCollectionRef) return null;
      if (role === 'schoolInstructor' && user) {
        return query(studentsCollectionRef, where('assignedInstructorIds', 'array-contains', user.uid));
      }
      return studentsCollectionRef;
    },
    [studentsCollectionRef, role, user]
  );

  const { data: students, isLoading } = useCollection<Student>(studentsQuery);

  const addStudent = async (student: Omit<Student, 'id' | 'registrationDate' | 'status'>) => {
    if (!user) {
      throw new Error('Firebase sign-in is not ready. Please refresh the app and try again.');
    }
    if (!studentsCollectionRef) {
      throw new Error('The students database is not ready yet. Please try again.');
    }
    const newStudent = {
      ...student,
      mobileNumber: student.mobileNumber || '',
      address: student.address || '',
      birthdate: student.birthdate || '',
      licenseNumber: student.licenseNumber || '',
      licenseExpiry: student.licenseExpiry || '',
      licenseType: student.licenseType || 'G2',
      comments: student.comments || '',
      tags: student.tags || [],
      assignedInstructorIds: role === 'schoolInstructor' && user ? [user.uid] : [],
      registrationDate: new Date().toISOString(),
      status: 'active'
    };
    return addDocumentNonBlocking(studentsCollectionRef, newStudent);
  };

  const updateStudent = async (student: Partial<Student> & {id: string}) => {
    if (!user) {
      throw new Error('Firebase sign-in is not ready. Please refresh the app and try again.');
    }
    if (!firestore) {
      throw new Error('The students database is not ready yet. Please try again.');
    }
    if (!studentsPath) {
      throw new Error('The students database is not ready yet. Please try again.');
    }
    const studentRef = doc(firestore, studentsPath, student.id);
    // Don't create a new object, to avoid overwriting fields that might not be in the form
    return updateDocumentNonBlocking(studentRef, student);
  };
  
  const deleteStudent = async (studentId: string) => {
    if (!user) {
      throw new Error('Firebase sign-in is not ready. Please refresh the app and try again.');
    }
    if (!firestore) {
      throw new Error('The students database is not ready yet. Please try again.');
    }
    if (!studentsPath) {
      throw new Error('The students database is not ready yet. Please try again.');
    }
    const studentRef = doc(firestore, studentsPath, studentId);
    return deleteDocumentNonBlocking(studentRef);
  };

  return { students, loading: isUserLoading || isLoading, addStudent, updateStudent, deleteStudent };
}
