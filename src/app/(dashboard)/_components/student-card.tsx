'use client';

import { Student, StudentStatus } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface StudentCardProps {
  student: Student;
  onClick: () => void;
}

const statusColors: Record<StudentStatus, string> = {
  active: 'bg-green-500/10 text-green-600 hover:bg-green-500/20',
  booked: 'bg-blue-500/10 text-blue-600 hover:bg-blue-500/20',
  'on-hold': 'bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20',
  deactivated: 'bg-gray-500/10 text-gray-600 hover:bg-gray-500/20',
};

export function StudentCard({ student, onClick }: StudentCardProps) {
  return (
    <Card
      onClick={onClick}
      className="cursor-pointer hover:shadow-md transition-all duration-200 border-none shadow-sm flex items-center justify-between p-3 gap-3 h-auto rounded-2xl bg-card"
    >
      <div className="flex items-center gap-3 min-w-0">
        <Avatar className="h-10 w-10 border shadow-sm">
           <AvatarImage src={student.avatarUrl || ""} alt={student.name} className="object-cover" />
           <AvatarFallback className="bg-primary/10 text-primary font-semibold">{student.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col min-w-0">
          <p className="font-semibold text-sm truncate text-foreground" title={student.name}>{student.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs text-muted-foreground truncate">{student.mobileNumber || 'No number'}</p>
          </div>
          {Array.isArray(student.tags) && student.tags.length > 0 && (
            <div className="mt-1 flex max-w-full flex-wrap gap-1">
              {student.tags.filter(t => t && typeof t === 'string').slice(0, 2).map(tag => (
                <Badge key={tag} variant="outline" className="h-4 max-w-[90px] truncate border-primary/20 px-1.5 py-0 text-[9px] font-medium text-primary">
                  {tag}
                </Badge>
              ))}
              {student.tags.filter(t => t && typeof t === 'string').length > 2 && (
                <Badge variant="outline" className="h-4 px-1.5 py-0 text-[9px] text-muted-foreground">
                  +{student.tags.filter(t => t && typeof t === 'string').length - 2}
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>
      
      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
        {student.status && (
          <Badge variant="outline" className={cn("text-[10px] px-2 py-0 h-5 border-none font-medium", statusColors[student.status])}>
            {student.status.charAt(0).toUpperCase() + student.status.slice(1)}
          </Badge>
        )}
        {student.licenseType && (
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 leading-none bg-secondary/50 text-secondary-foreground uppercase font-bold tracking-wider">
            {student.licenseType}
          </Badge>
        )}
      </div>
    </Card>
  );
}
