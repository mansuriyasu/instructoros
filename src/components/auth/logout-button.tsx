'use client';

import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { clearOffline, readOfflineState } from '../../../public/offline-store';
import { disablePush } from '@/firebase/messaging';

interface LogoutButtonProps {
  className?: string;
}

export function LogoutButton({ className }: LogoutButtonProps) {
  const auth = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  if (!user) return null;

  const handleLogout = async () => {
    try {
    const offline = await readOfflineState().catch(() => null);
    const pending = offline?.drafts.filter(draft => draft.status !== 'synced').length || 0;
    if (pending && !window.confirm(`${pending} entries have not been confirmed as synced. Logout clears saved data on this phone. Cancel to sync first, or continue to discard local drafts and log out.`)) return;
    if (offline?.config || offline?.drafts.length) await clearOffline();
    if ('serviceWorker' in navigator) await disablePush().catch(() => {});
    await signOut(auth);
    router.replace('/login');
    } catch (error) { toast({ variant: 'destructive', title: 'Could not finish logout', description: error instanceof Error ? error.message : 'Please try again.' }); }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      className={cn('w-full justify-start gap-3 rounded-lg px-3 py-2 text-muted-foreground hover:text-primary', className)}
      onClick={handleLogout}
    >
      <LogOut className="h-4 w-4" />
      Logout
    </Button>
  );
}
