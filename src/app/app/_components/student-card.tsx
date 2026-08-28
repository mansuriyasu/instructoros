'use client';

import { format, isSameDay, isTomorrow } from 'date-fns';
import { Calendar, MessageCircle, Phone } from 'lucide-react';
import { CalendarEvent, Student, StudentStatus } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

interface StudentCardProps {
  student: Student;
  nextLesson?: CalendarEvent;
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

export function StudentCard({ student, nextLesson, onClick, onSchedule }: StudentCardProps) {
  const phone = normalizePhone(student.mobileNumber);
  const tags = Array.isArray(student.tags) ? student.tags.filter(tag => tag && typeof tag === 'string') : [];
  const isSelfSubmitted = Boolean(student.registrationCompletedAt || student.portalEmail || student.privacyAcceptedAt);
  const visibleTag = tags.find(tag => !/^self-submitted$/i.test(tag));

  return (
    <Card
      onClick={onClick}
      className="cursor-pointer rounded-[20px] border-border/70 bg-card p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <Avatar className="h-12 w-12 shrink-0 border bg-amber-50 shadow-sm">
            <AvatarImage src={student.avatarUrl || ''} alt={student.name} className="object-cover" />
            <AvatarFallback className="bg-amber-50 text-lg font-bold text-amber-600">
              {(student.name || '?').charAt(0).toUpperCase()}
            </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold leading-tight text-foreground" title={student.name}>
            {student.name}
          </p>
          <p className="mt-1 truncate text-sm leading-tight text-muted-foreground">
            {student.mobileNumber || 'No phone'}
          </p>

          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5">
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
              <Badge variant="outline" className="h-5 max-w-[130px] truncate rounded-full border-primary/20 bg-primary/5 px-2 text-[10px] font-semibold text-primary">
                {visibleTag}
              </Badge>
            )}
            {student.status === 'deactivated' && (
              <Badge variant="outline" className="h-5 rounded-full bg-slate-100 px-2 text-[10px] font-semibold text-slate-600">
                {statusLabels[student.status]}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex w-[132px] shrink-0 flex-col items-end gap-2">
          <div className={`flex max-w-full items-center gap-1 text-right text-xs font-semibold ${nextLessonTone(nextLesson)}`}>
            <Calendar className="h-4 w-4 shrink-0" />
            <span className="truncate">{nextLessonLabel(nextLesson)}</span>
          </div>
          <div className="flex items-center justify-end gap-1.5">
            {phone ? (
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
            ) : (
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
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 rounded-full bg-card px-3 text-xs font-semibold"
              onClick={(event) => {
                event.stopPropagation();
                onClick();
              }}
              aria-label={`Open ${student.name}`}
            >
              Open
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
