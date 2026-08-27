'use client';

import { format, isSameDay, isTomorrow } from 'date-fns';
import { Calendar, MessageCircle, MoreHorizontal, Phone } from 'lucide-react';
import { CalendarEvent, Student, StudentStatus } from '@/lib/types';
import { cn } from '@/lib/utils';
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

const statusDotColors: Record<StudentStatus, string> = {
  active: 'bg-emerald-500',
  booked: 'bg-blue-600',
  'on-hold': 'bg-amber-500',
  deactivated: 'bg-slate-400',
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
      className="cursor-pointer rounded-[24px] border-border/70 bg-card p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex gap-4">
        <div className="relative shrink-0">
          <Avatar className="h-14 w-14 border bg-amber-50 shadow-sm">
            <AvatarImage src={student.avatarUrl || ''} alt={student.name} className="object-cover" />
            <AvatarFallback className="bg-amber-50 text-xl font-bold text-amber-600">
              {(student.name || '?').charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span
            className={cn(
              'absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-card',
              statusDotColors[student.status] || statusDotColors.active
            )}
            title={student.status}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-foreground" title={student.name}>
                {student.name}
              </p>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                {student.mobileNumber || 'No phone'}
              </p>
            </div>

            <div className={cn('flex shrink-0 items-center gap-1 text-sm font-semibold', nextLessonTone(nextLesson))}>
              <Calendar className="h-4 w-4" />
              <span className="max-w-[132px] truncate">{nextLessonLabel(nextLesson)}</span>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {student.licenseType && (
              <Badge variant="secondary" className="h-6 rounded-full bg-slate-100 px-2 text-[11px] font-bold text-slate-700">
                {student.licenseType}
              </Badge>
            )}
            {isSelfSubmitted && (
              <Badge variant="outline" className="h-6 rounded-full border-amber-200 bg-amber-50 px-2 text-[11px] font-semibold text-amber-700">
                Self-submitted
              </Badge>
            )}
            {visibleTag && (
              <Badge variant="outline" className="h-6 max-w-[140px] truncate rounded-full border-primary/20 bg-primary/5 px-2 text-[11px] font-semibold text-primary">
                {visibleTag}
              </Badge>
            )}
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            {phone ? (
              <>
                <Button
                  asChild
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 rounded-full bg-card text-emerald-600"
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
                  className="h-11 w-11 rounded-full bg-card text-blue-600"
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
                className="h-11 w-11 rounded-full bg-card text-blue-600"
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
              size="icon"
              className="h-11 w-11 rounded-full bg-card"
              onClick={(event) => {
                event.stopPropagation();
                onClick();
              }}
              aria-label={`Open ${student.name}`}
            >
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
