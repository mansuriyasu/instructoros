'use client';

import { format, formatDistanceToNow, isSameDay, isTomorrow } from 'date-fns';
import { Calendar, MessageCircle, Phone } from 'lucide-react';
import { CalendarEvent, Student, StudentStatus } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface StudentCardProps {
  student: Student;
  nextLesson?: CalendarEvent;
  isNewRegistration?: boolean;
  showRegistrationTime?: boolean;
  onClick: () => void;
  onSchedule?: () => void;
}

const statusLabels: Record<StudentStatus, string> = {
  active: 'Active',
  booked: 'Booked',
  'on-hold': 'On hold',
  deactivated: 'Deactivated',
};

function normalizePhone(phone?: string) {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length === 10 ? `1${digits}` : digits;
}

function nextLessonLabel(nextLesson?: CalendarEvent) {
  if (!nextLesson?.start) return 'No upcoming lesson';
  const start = new Date(nextLesson.start);
  const now = new Date();
  if (isSameDay(start, now)) return `Today, ${format(start, 'h:mm a')}`;
  if (isTomorrow(start)) return `Tomorrow, ${format(start, 'h:mm a')}`;
  return format(start, 'MMM d, h:mm a');
}

function nextLessonTone(nextLesson?: CalendarEvent) {
  if (!nextLesson?.start) return 'text-slate-500';
  const start = new Date(nextLesson.start);
  const now = new Date();
  if (isSameDay(start, now) && start < now) return 'text-red-600';
  if (isSameDay(start, now)) return 'text-emerald-600';
  return 'text-blue-600';
}

export function StudentCard({ student, nextLesson, isNewRegistration = false, showRegistrationTime = false, onClick, onSchedule }: StudentCardProps) {
  const phone = normalizePhone(student.mobileNumber);
  const tags = Array.isArray(student.tags) ? student.tags.filter(tag => tag && typeof tag === 'string') : [];
  const isSelfSubmitted = Boolean(student.registrationCompletedAt || student.portalEmail || student.privacyAcceptedAt);
  const visibleTag = tags.find(tag => !/^self-submitted$/i.test(tag));

  return (
    <Card
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-[20px] border-border/70 bg-card p-3 shadow-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]",
        isNewRegistration && "border-amber-300 bg-amber-50/60 ring-1 ring-amber-200/70 dark:bg-amber-950/20",
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar className="h-12 w-12 shrink-0 border bg-amber-50 shadow-sm">
            <AvatarImage src={student.avatarUrl || ''} alt={student.name} className="object-cover" />
            <AvatarFallback className="bg-amber-50 text-lg font-bold text-amber-600">
              {(student.name || '?').charAt(0).toUpperCase()}
            </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-base font-bold leading-tight text-foreground" title={student.name}>
              {student.name}
            </p>
            {isNewRegistration && (
              <Badge className="h-5 shrink-0 rounded-full bg-amber-500 px-2 text-[10px] font-bold text-white hover:bg-amber-500">
                New
              </Badge>
            )}
          </div>
          <p className="mt-1 truncate text-sm leading-tight text-muted-foreground">
            {student.mobileNumber || 'No phone'}
          </p>
          <div className={`mt-1 flex min-w-0 items-center gap-1 text-xs font-semibold ${nextLessonTone(nextLesson)}`}>
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{nextLessonLabel(nextLesson)}</span>
          </div>
          {showRegistrationTime && Number.isFinite(Date.parse(student.registrationDate)) && (
            <p className="mt-1 truncate text-[11px] font-medium text-amber-700 dark:text-amber-300">
              Registered {formatDistanceToNow(new Date(student.registrationDate), { addSuffix: true })}
            </p>
          )}
        </div>
      </div>

      <div className="mt-2 flex items-end justify-between gap-2 pl-[60px]">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {student.licenseType && (
            <Badge variant="secondary" className="h-5 rounded-full bg-slate-100 px-2 text-[10px] font-bold text-slate-700">
              {student.licenseType}
            </Badge>
          )}
          {isSelfSubmitted && (
            <Badge variant="outline" className="h-5 rounded-full border-amber-200 bg-amber-50 px-2 text-[10px] font-semibold text-amber-700">
              Self-submitted
            </Badge>
          )}
          {visibleTag && (
            <Badge variant="outline" className="h-5 max-w-[130px] truncate rounded-full border-border bg-muted px-2 text-[10px] font-semibold text-foreground/80">
              {visibleTag}
            </Badge>
          )}
          {student.status === 'deactivated' && (
            <Badge variant="outline" className="h-5 rounded-full bg-slate-100 px-2 text-[10px] font-semibold text-slate-600">
              {statusLabels[student.status]}
            </Badge>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {phone && (
            <>
              <Button
                asChild
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-full bg-card text-emerald-600"
                onClick={(event) => event.stopPropagation()}
              >
                <a href={`tel:+${phone}`} aria-label={`Call ${student.name}`}>
                  <Phone className="h-5 w-5" />
                </a>
              </Button>
              <Button
                asChild
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-full bg-card text-blue-600"
                onClick={(event) => event.stopPropagation()}
              >
                <a
                  href={`https://wa.me/${phone}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Message ${student.name}`}
                >
                  <MessageCircle className="h-5 w-5" />
                </a>
              </Button>
            </>
          )}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-full bg-card text-blue-600"
            onClick={(event) => {
              event.stopPropagation();
              onSchedule?.();
            }}
            aria-label={`Schedule ${student.name}`}
          >
            <Calendar className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
