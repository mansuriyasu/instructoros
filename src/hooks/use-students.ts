"use client";

import { Student } from '@/lib/types';
import { useCallback, useEffect, useState } from 'react';
import { useFirestore, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking, useUser, useSession, useTenantCollectionPath } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { getWorkspaceAccess } from '@/lib/workspace-access';
import { getAuthenticatedHeaders } from '@/lib/authenticated-fetch';

type UseStudentsOptions = {
  load?: boolean;
};

export function useStudents(options: UseStudentsOptions = {}) {
  const shouldLoadStudents = options.load !== false;
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

  const [students, setStudents] = useState<Array<Student & { id: string }> | null>(null);
  const [studentsLoading, setStudentsLoading] = useState(false);

  const refreshStudents = useCallback(async (isCancelled?: () => boolean) => {
    if (!shouldLoadStudents) {
      setStudents(null);
      setStudentsLoading(false);
      return;
    }

    if (isSessionLoading || !user || !activeTenantId || !role || !tenant || !member) {
      setStudents(null);
      setStudentsLoading(false);
      return;
    }

    setStudentsLoading(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/students/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tenantId: activeTenantId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not load students.');
      if (!isCancelled?.()) setStudents(result.students || []);
    } catch {
      if (!isCancelled?.()) setStudents([]);
    } finally {
      if (!isCancelled?.()) setStudentsLoading(false);
    }
  }, [activeTenantId, isSessionLoading, member, role, shouldLoadStudents, tenant, user]);

  useEffect(() => {
    let cancelled = false;
    void refreshStudents(() => cancelled);
    return () => { cancelled = true; };
  }, [refreshStudents]);

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
    const created = await addDocumentNonBlocking(studentsCollectionRef, newStudent);
    await refreshStudents();
    return created;
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
    const updated = await updateDocumentNonBlocking(studentRef, student);
    setStudents(current => current?.map(item => item.id === student.id ? { ...item, ...student } : item) || current);
    return updated;
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
    const deleted = await deleteDocumentNonBlocking(studentRef);
    setStudents(current => current?.filter(item => item.id !== studentId) || current);
    return deleted;
  };

  const mergeStudentGroups = async (groups: Array<{ primaryId: string; duplicateIds: string[] }>) => {
    if (!user || !activeTenantId) {
      throw new Error('Your workspace is not ready yet. Please try again.');
    }
    const response = await fetch('/api/students/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getAuthenticatedHeaders()) },
      body: JSON.stringify({ tenantId: activeTenantId, groups }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Could not merge students.');
    await refreshStudents();
    return result as { mergedStudentCount: number; reassignedRecordCount: number };
  };

  const mergeStudents = (primaryId: string, duplicateIds: string[]) =>
    mergeStudentGroups([{ primaryId, duplicateIds }]);

  return { students, loading: isUserLoading || studentsLoading || isSessionLoading, addStudent, updateStudent, deleteStudent, mergeStudents, mergeStudentGroups, refreshStudents };
}
