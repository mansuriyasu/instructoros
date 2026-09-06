'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from '@/firebase';
import { notificationRequest } from '@/firebase/messaging';
function OpenNotification() {
  const params = useSearchParams(); const router = useRouter();
  const { user, isSessionLoading } = useSession();
  const [error, setError] = useState('');
  useEffect(() => {
    if (!user || isSessionLoading) return;
    const id = params.get('id');
    if (!id || !/^[a-f0-9]{64}$/.test(id)) { setError('Notification not found.'); return; }
    void notificationRequest(`?open=${id}`).then(result => router.replace(result.url)).catch(e => setError(e.message));
  }, [user, isSessionLoading, params, router]);
  return <p role="status" className="p-4 text-sm">{error || 'Opening notification...'}</p>;
}
export default function Page() { return <Suspense fallback={<p>Opening notification...</p>}><OpenNotification /></Suspense>; }
