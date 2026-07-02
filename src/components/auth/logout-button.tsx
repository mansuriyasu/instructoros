'use client';

import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth, useUser } from '@/firebase';
import { cn } from '@/lib/utils';

interface LogoutButtonProps {
  className?: string;
}

export function LogoutButton({ className }: LogoutButtonProps) {
  const auth = useAuth();
  const { user } = useUser();
  const router = useRouter();

  if (!user) return null;

  const handleLogout = async () => {
    await signOut(auth);
    router.replace('/login');
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
