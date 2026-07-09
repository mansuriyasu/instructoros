'use client';

import { useMemo } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  startOfWeek,
  endOfWeek,
} from 'date-fns';
import { cn, getServiceColorName } from '@/lib/utils';
import { CalendarEvent } from '@/lib/types';
import { useEvents } from '@/hooks/use-events';
import { Skeleton } from '@/components/ui/skeleton';

interface MonthViewProps {
  currentDate: Date;
  onEventClick: (event: CalendarEvent) => void;
  onDayClick: (date: Date) => void;
  searchQuery?: string;
  selectedInstructorId?: string;
  instructorNameById?: Record<string, string>;
}

export function MonthView({ currentDate, onEventClick, onDayClick, searchQuery, selectedInstructorId = 'all', instructorNameById = {} }: MonthViewProps) {
  const firstDayOfMonth = startOfMonth(currentDate);
  const lastDayOfMonth = endOfMonth(currentDate);
  
  const daysInMonth = useMemo(() => eachDayOfInterval({
    start: startOfWeek(firstDayOfMonth),
    end: endOfWeek(lastDayOfMonth),
  }), [firstDayOfMonth, lastDayOfMonth]);

  const { events, loading } = useEvents(
    startOfWeek(firstDayOfMonth),
    endOfWeek(lastDayOfMonth)
  );

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    
    let filteredEvents = events;
    if (selectedInstructorId !== 'all') {
      filteredEvents = filteredEvents.filter(event => event.instructorId === selectedInstructorId);
    }
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filteredEvents = filteredEvents.filter(e => 
            e.studentName?.toLowerCase().includes(query) || 
            e.title?.toLowerCase().includes(query) ||
            (e.instructorId && instructorNameById[e.instructorId]?.toLowerCase().includes(query))
        );
    }

    filteredEvents.forEach(event => {
      const dayKey = format(new Date(event.start), 'yyyy-MM-dd');
      if (!map.has(dayKey)) {
        map.set(dayKey, []);
      }
      map.get(dayKey)!.push(event);
    });
    // Sort events within each day
    map.forEach(dayEvents => dayEvents.sort((a,b) => new Date(a.start).getTime() - new Date(b.start).getTime()));
    return map;
  }, [events, instructorNameById, searchQuery, selectedInstructorId]);

  if (loading) {
      return (
        <div className="grid flex-1 grid-cols-7 overflow-hidden rounded-2xl border-l border-t md:min-w-[760px] md:rounded-lg">
            {Array.from({length: 35}).map((_, i) => (
                <div key={i} className="border-b border-r p-1.5 min-h-[120px]">
                    <Skeleton className="h-full w-full" />
                </div>
            ))}
        </div>
      )
  }

  return (
    <>
    <div className="overflow-hidden rounded-2xl border-l border-t bg-background md:hidden">
      <div className="grid grid-cols-7">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
          <div key={`${day}-${index}`} className="border-b border-r bg-muted/50 p-2 text-center text-[11px] font-bold text-muted-foreground">
            {day}
          </div>
        ))}
        {daysInMonth.map(day => {
          const dayKey = format(day, 'yyyy-MM-dd');
          const dayEvents = eventsByDay.get(dayKey) || [];
          const isCurrentMonth = isSameMonth(day, currentDate);

          return (
            <button
              key={day.toString()}
              type="button"
              className={cn(
                'flex min-h-[76px] flex-col border-b border-r p-1.5 text-left transition-colors active:bg-muted/70',
                !isCurrentMonth && 'bg-muted/25 text-muted-foreground'
              )}
              onClick={() => onDayClick(day)}
            >
              <span
                className={cn(
                  'mb-1 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold',
                  isSameDay(day, new Date()) && 'bg-primary text-primary-foreground',
                )}
              >
                {format(day, 'd')}
              </span>
              <div className="mt-auto flex flex-wrap gap-1">
                {dayEvents.slice(0, 3).map(event => {
                  const isBlocked = !event.studentId;
                  const colorName = getServiceColorName(event.services?.[0]?.id);

                  return (
                    <span
                      key={event.id}
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        isBlocked
                          ? 'bg-slate-400'
                          : {
                            'bg-chart-1': colorName === 'chart-1',
                            'bg-chart-2': colorName === 'chart-2',
                            'bg-chart-3': colorName === 'chart-3',
                            'bg-chart-4': colorName === 'chart-4',
                            'bg-chart-5': colorName === 'chart-5',
                          }
                      )}
                    />
                  );
                })}
                {dayEvents.length > 3 && (
                  <span className="text-[10px] font-semibold text-muted-foreground">+{dayEvents.length - 3}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>

    <div className="mt-3 space-y-2 md:hidden">
      {daysInMonth
        .filter(day => isSameMonth(day, currentDate) && (eventsByDay.get(format(day, 'yyyy-MM-dd')) || []).length > 0)
        .map(day => {
          const dayEvents = eventsByDay.get(format(day, 'yyyy-MM-dd')) || [];

          return (
            <section key={day.toISOString()} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
              <button
                type="button"
                onClick={() => onDayClick(day)}
                className="flex w-full items-center justify-between border-b px-4 py-3 text-left active:bg-muted/70"
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{format(day, 'EEEE')}</p>
                  <h3 className="font-bold">{format(day, 'MMMM d')}</h3>
                </div>
                <span className="rounded-full bg-muted px-3 py-1 text-sm font-semibold text-muted-foreground">{dayEvents.length}</span>
              </button>
              <div className="divide-y">
                {dayEvents.slice(0, 4).map(event => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => onEventClick(event)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-muted/70"
                  >
                    <span className="w-16 shrink-0 text-sm font-semibold text-muted-foreground">{format(new Date(event.start), 'h:mm a')}</span>
                    <span className="min-w-0 flex-1 truncate font-semibold">{event.studentName !== 'N/A' ? event.studentName : event.title}</span>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
    </div>

    <div className="hidden overflow-auto rounded-lg border-l border-t bg-background md:block">
      <div className="grid min-w-[760px] flex-1 grid-cols-7">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="border-b border-r bg-muted/50 p-2 text-center text-sm font-semibold">
            {day}
          </div>
        ))}
        {daysInMonth.map(day => {
          const dayKey = format(day, 'yyyy-MM-dd');
          const dayEvents = eventsByDay.get(dayKey) || [];
          const isBlocked = dayEvents.some(e => !e.studentId);
          return (
            <div
              key={day.toString()}
              className={cn(
                'flex min-h-[120px] cursor-pointer flex-col border-b border-r p-2 transition-colors duration-200 hover:bg-muted/50',
                !isSameMonth(day, currentDate) && 'bg-muted/30 text-muted-foreground',
                isBlocked && 'bg-slate-50'
              )}
              onClick={() => onDayClick(day)}
            >
              <span
                className={cn(
                  'mb-1 flex h-7 w-7 items-center justify-center self-end rounded-full text-sm font-medium',
                  isSameDay(day, new Date()) && 'bg-primary text-primary-foreground',
                )}
              >
                {format(day, 'd')}
              </span>
              <div className="flex-1 space-y-1 overflow-hidden">
                {dayEvents.slice(0, 3).map(event => {
                  const isBlocked = !event.studentId;
                  const colorName = getServiceColorName(event.services?.[0]?.id);
                  return (
                    <div
                      key={event.id}
                      className={cn("rounded-md px-2 py-1 text-xs leading-tight hover:opacity-80",
                        isBlocked
                          ? 'bg-slate-200 text-slate-600'
                          : {
                            'bg-chart-1/20 text-chart-1': colorName === 'chart-1',
                            'bg-chart-2/20 text-chart-2': colorName === 'chart-2',
                            'bg-chart-3/20 text-chart-3': colorName === 'chart-3',
                            'bg-chart-4/20 text-chart-4': colorName === 'chart-4',
                            'bg-chart-5/20 text-chart-5': colorName === 'chart-5',
                          }
                      )}
                      onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
                    >
                      <p className="truncate font-semibold">{event.studentName !== 'N/A' ? event.studentName : event.title}</p>
                      {event.instructorId && instructorNameById[event.instructorId] && (
                        <p className="truncate opacity-80">{instructorNameById[event.instructorId]}</p>
                      )}
                    </div>
                  )
                })}
                {dayEvents.length > 3 && (
                  <p className="mt-1 text-xs text-muted-foreground">+ {dayEvents.length - 3} more</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
    </>
  );
}
