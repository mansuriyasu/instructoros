'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical } from 'lucide-react';
import { useRouter } from 'next/navigation';


export function StudentGridActions() {
  const router = useRouter();
  
  const handleGoToImportExport = () => {
    router.push('/import-export');
  };

  return (
    <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleGoToImportExport}>
            Import / Export
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
  );
}
