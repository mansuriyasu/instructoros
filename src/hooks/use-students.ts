"use client";

import { Student } from '@/lib/types';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking, useUser } from '@/firebase';
import { collection, doc } from 'firebase/firestore';

export function useStudents() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();

  const studentsCollectionRef = useMemoFirebase(
    () => (firestore && user ? collection(firestore, 'students') : null),
    [firestore, user]
  );

  const { data: students, isLoading } = useCollection<Student>(studentsCollectionRef);

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
    const studentRef = doc(firestore, 'students', student.id);
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
    const studentRef = doc(firestore, 'students', studentId);
    return deleteDocumentNonBlocking(studentRef);
  };

  return { students, loading: isUserLoading || isLoading, addStudent, updateStudent, deleteStudent };
}
