"use client";

import { Student } from '@/lib/types';
import { useEffect, useState } from 'react';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking, useUser, useSession, useTenantCollectionPath } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import { getWorkspaceAccess } from '@/lib/workspace-access';

export function useStudents() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { role, tenant, member, activeTenantId, isSessionLoading } = useSession();
  const studentsPath = useTenantCollectionPath('students');

  const studentsCollectionRef = useMemoFirebase(
    () => (
      firestore
      && user
      && studentsPath
      && !isSessionLoading
      && role
      && activeTenantId
      && tenant
      && member
        ? collection(firestore, studentsPath)
        : null
    ),
    [activeTenantId, firestore, isSessionLoading, member, role, studentsPath, tenant, user]
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

  const isSchoolInstructor = role === 'schoolInstructor';
  const { data: firestoreStudents, isLoading } = useCollection<Student>(isSchoolInstructor ? null : studentsQuery);
  const [assignedStudents, setAssignedStudents] = useState<Array<Student & { id: string }> | null>(null);
  const [assignedStudentsLoading, setAssignedStudentsLoading] = useState(false);

  useEffect(() => {
    if (!isSchoolInstructor || isSessionLoading || !user || !activeTenantId) {
      setAssignedStudents(null);
      setAssignedStudentsLoading(false);
      return;
    }

    let cancelled = false;
    setAssignedStudentsLoading(true);
    void user.getIdToken().then(token => fetch('/api/students/assigned', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ tenantId: activeTenantId }),
    })).then(async response => {
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not load assigned students.');
      if (!cancelled) setAssignedStudents(result.students || []);
    }).catch(() => {
      if (!cancelled) setAssignedStudents([]);
    }).finally(() => {
      if (!cancelled) setAssignedStudentsLoading(false);
    });

    return () => { cancelled = true; };
  }, [activeTenantId, isSchoolInstructor, isSessionLoading, user]);

  const students = isSchoolInstructor ? assignedStudents : firestoreStudents;

  const addStudent = async (student: Omit<Student, 'id' | 'registrationDate' | 'status'>) => {
    if (!user) {
      throw new Error('Firebase sign-in is not ready. Please refresh the app and try again.');
    }
    if (isSessionLoading || !activeTenantId || !tenant || !member) {
      throw new Error('Your workspace is still loading. Please wait a moment and try again.');
    }
    if (member.status !== 'active' || tenant.status !== 'active') {
      throw new Error('Your account is not active in this workspace. Ask the workspace owner to activate your access.');
    }
    if (!getWorkspaceAccess(tenant).canWrite) {
      throw new Error('This workspace is locked until billing or free access is activated.');
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

  return { students, loading: isUserLoading || (isSchoolInstructor ? assignedStudentsLoading : isLoading) || isSessionLoading, addStudent, updateStudent, deleteStudent };
}
