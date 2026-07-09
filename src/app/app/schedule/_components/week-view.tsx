'use client';

import { useMemo, useState, useEffect } from 'react';
import {
  format,
  startOfWeek,
  eachDayOfInterval,
  isSameDay,
  setHours,
  endOfWeek,
} from 'date-fns';
import { cn, getServiceColorName } from '@/lib/utils';
import { CalendarEvent } from '@/lib/types';
import { useEvents } from '@/hooks/use-events';
import { Skeleton } from '@/components/ui/skeleton';

interface WeekViewProps {
  currentDate: Date;
  onEventClick: (event: CalendarEvent) => void;
  onSlotClick: (date: Date) => void;
  onEventDrop: (eventId: string, newStart: Date, newEnd: Date) => void;
  searchQuery?: string;
  selectedInstructorId?: string;
  instructorNameById?: Record<string, string>;
}

const HOUR_HEIGHT_IN_PIXELS = 80;

export function WeekView({ currentDate, onEventClick, onSlotClick, onEventDrop, searchQuery, selectedInstructorId = 'all', instructorNameById = {} }: WeekViewProps) {
  const weekStart = useMemo(() => startOfWeek(currentDate), [currentDate]);
  const weekEnd = useMemo(() => endOfWeek(currentDate), [currentDate]);
  const weekDays = useMemo(() => eachDayOfInterval({ start: weekStart, end: weekEnd }), [weekStart, weekEnd]);

  const { events, loading } = useEvents(weekStart, weekEnd);
  
  const [dragOverSlot, setDragOverSlot] = useState<Date | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

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
      if (!map.has(dayKey)) map.set(dayKey, []);
      map.get(dayKey)!.push(event);
    });
    map.forEach(dayEvents => dayEvents.sort((a,b) => new Date(a.start).getTime() - new Date(b.start).getTime()));
    return map;
  }, [events, instructorNameById, searchQuery, selectedInstructorId]);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, event: CalendarEvent) => {
    e.dataTransfer.setData('application/json', JSON.stringify(event));
    e.dataTransfer.effectAllowed = 'move';
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, slotDate: Date) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverSlot(slotDate);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, slotDate: Date) => {
    e.preventDefault();
    const eventDataString = e.dataTransfer.getData('application/json');
    if (eventDataString) {
      const droppedEvent: CalendarEvent = JSON.parse(eventDataString);
      const originalStart = new Date(droppedEvent.start);
      const originalEnd = new Date(droppedEvent.end);
      const duration = originalEnd.getTime() - originalStart.getTime();

      const newStart = slotDate;
      const newEnd = new Date(newStart.getTime() + duration);

      onEventDrop(droppedEvent.id, newStart, newEnd);
    }
    setDragOverSlot(null);
  };


  if (loading) {
    return (
      <div className="rounded-lg border">
        <Skeleton className="w-full h-[600px]" />
      </div>
    );
  }

  const hours = Array.from({ length: 14 }, (_, i) => i + 8); // 8 AM to 9 PM

  const currentTimePosition = (currentTime.getHours() - 8 + currentTime.getMinutes() / 60) * HOUR_HEIGHT_IN_PIXELS;

  return (
    <>
      <div className="space-y-3 md:hidden">
        {weekDays.map(day => {
          const dayKey = format(day, 'yyyy-MM-dd');
          const dayEvents = eventsByDay.get(dayKey) || [];

          return (
            <section key={day.toISOString()} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
              <div className={cn(
                "flex items-center justify-between border-b px-4 py-3",
                isSameDay(day, new Date()) && "bg-primary text-primary-foreground"
              )}>
                <div>
                  <p className={cn("text-xs font-semibold uppercase tracking-wide", isSameDay(day, new Date()) ? "text-primary-foreground/75" : "text-muted-foreground")}>
                    {format(day, 'EEEE')}
                  </p>
                  <h3 className="text-lg font-bold">{format(day, 'MMM d')}</h3>
                </div>
                <span className={cn("rounded-full px-3 py-1 text-sm font-semibold", isSameDay(day, new Date()) ? "bg-white/15" : "bg-muted text-muted-foreground")}>
                  {dayEvents.length}
                </span>
              </div>

              {dayEvents.length === 0 ? (
                <button
                  type="button"
                  onClick={() => onSlotClick(setHours(day, 9))}
                  className="w-full px-4 py-5 text-left text-sm text-muted-foreground active:bg-muted/70"
                >
                  No appointments. Tap to add one.
                </button>
              ) : (
                <div className="divide-y">
                  {dayEvents.map(event => {
                    const start = new Date(event.start);
                    const end = new Date(event.end);
                    const isBlocked = !event.studentId;
                    const colorName = getServiceColorName(event.services?.[0]?.id);

                    return (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => onEventClick(event)}
                        className="grid w-full grid-cols-[4.25rem_1fr] gap-3 px-4 py-3 text-left active:bg-muted/70"
                      >
                        <span className="pt-1 text-sm font-bold">{format(start, 'h:mm a')}</span>
                        <span
                          className={cn(
                            "min-w-0 rounded-2xl border-l-4 px-3 py-2 shadow-sm",
                            isBlocked
                              ? 'border-slate-300 bg-slate-100 text-slate-700'
                              : {
                                'border-chart-1 bg-chart-1/10 text-chart-1': colorName === 'chart-1',
                                'border-chart-2 bg-chart-2/10 text-chart-2': colorName === 'chart-2',
                                'border-chart-3 bg-chart-3/10 text-chart-3': colorName === 'chart-3',
                                'border-chart-4 bg-chart-4/10 text-chart-4': colorName === 'chart-4',
                                'border-chart-5 bg-chart-5/10 text-chart-5': colorName === 'chart-5',
                              }
                          )}
                        >
                          <span className="block truncate font-semibold">{event.studentName !== 'N/A' ? event.studentName : event.title}</span>
                          <span className="mt-1 block truncate text-xs opacity-75">{format(start, 'h:mm a')} - {format(end, 'h:mm a')}</span>
                          {event.instructorId && instructorNameById[event.instructorId] && (
                            <span className="mt-1 block truncate text-xs opacity-75">{instructorNameById[event.instructorId]}</span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <div className="hidden overflow-auto rounded-lg border bg-background md:block">
      <div className="grid min-w-[920px] grid-cols-[4.5rem_1fr] h-full bg-background">
        <div className="border-r sticky top-0 bg-background z-20">
          <div className="h-24"></div> {/* Spacer for header */}
          {hours.map(hour => (
            <div key={hour} className="h-20 pr-3 pt-2 text-right" style={{ height: `${HOUR_HEIGHT_IN_PIXELS}px` }}>
              <span className="text-xs text-muted-foreground">{format(setHours(new Date(), hour), 'h a')}</span>
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 relative">
            {weekDays.map(day => (
              <div key={day.toString()} className="sticky top-0 z-10 flex h-24 flex-col items-center justify-center border-b border-l bg-background/95 p-2 text-center backdrop-blur-sm">
                  <span className="text-sm font-semibold">{format(day, 'EEE')}</span>
                  <span className={cn(
                      "text-2xl font-bold h-10 w-10 flex items-center justify-center rounded-full mt-1",
                      isSameDay(day, new Date()) && "bg-primary text-primary-foreground"
                  )}>
                      {format(day, 'd')}
                  </span>
              </div>
            ))}

            {weekDays.map((day, dayIndex) => {
              const dayKey = format(day, 'yyyy-MM-dd');
              const dayEvents = eventsByDay.get(dayKey) || [];

              return (
                <div key={day.toString()} className={cn("relative border-l", dayIndex === 0 && "border-l-0")}>
                  {hours.map((hour, hourIndex) => {
                      const slotDate = setHours(day, hour);
                      return (
                        <div
                          key={hour}
                          className={cn(
                            "h-20 cursor-pointer border-t transition-colors hover:bg-muted/40",
                            hourIndex % 2 === 0 ? 'bg-muted/15' : '',
                            dragOverSlot && isSameDay(dragOverSlot, day) && dragOverSlot.getHours() === hour && 'bg-accent/60'
                          )}
                          style={{ height: `${HOUR_HEIGHT_IN_PIXELS}px` }}
                          onClick={() => onSlotClick(slotDate)}
                          onDragOver={(e) => handleDragOver(e, slotDate)}
                          onDrop={(e) => handleDrop(e, slotDate)}
                          onDragLeave={() => setDragOverSlot(null)}
                        ></div>
                      );
                  })}
                  
                  {isSameDay(day, currentTime) && currentTimePosition >= 0 && (
                    <div className="absolute w-full h-px bg-red-500 z-10" style={{ top: currentTimePosition }}>
                        <div className="absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full bg-red-500"></div>
                    </div>
                  )}

                  {dayEvents.map(event => {
                    const start = new Date(event.start);
                    const end = new Date(event.end);
                    const startMinutes = (start.getHours() - 8) * 60 + start.getMinutes();
                    const top = (startMinutes / 60) * HOUR_HEIGHT_IN_PIXELS;

                    const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
                    const height = Math.max(30, (durationMinutes / 60) * HOUR_HEIGHT_IN_PIXELS);
                    
                    const isBlocked = !event.studentId;
                    const colorName = getServiceColorName(event.services?.[0]?.id);
                    
                    return (
                      <div
                        key={event.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, event)}
                        className={cn(
                          "absolute left-1 w-[calc(100%-8px)] cursor-pointer overflow-hidden rounded-lg border-l-4 p-2 shadow-sm transition-all hover:z-20 hover:shadow-md",
                          isBlocked
                            ? 'bg-slate-100 border-slate-300 text-slate-600'
                            : {
                              'bg-chart-1/80 border-chart-1 text-primary-foreground': colorName === 'chart-1',
                              'bg-chart-2/80 border-chart-2 text-primary-foreground': colorName === 'chart-2',
                              'bg-chart-3/80 border-chart-3 text-primary-foreground': colorName === 'chart-3',
                              'bg-chart-4/80 border-chart-4 text-primary-foreground': colorName === 'chart-4',
                              'bg-chart-5/80 border-chart-5 text-black': colorName === 'chart-5',
                            }
                        )}
                        style={{ top: `${top}px`, height: `${height}px` }}
                        onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
                      >
                        <p className="text-sm font-bold truncate">{event.studentName !== 'N/A' ? event.studentName : event.title}</p>
                        <p className="text-xs opacity-90 truncate">{format(start, 'h:mm a')} - {format(end, 'h:mm a')}</p>
                        {event.instructorId && instructorNameById[event.instructorId] && (
                          <p className="text-xs opacity-80 truncate">{instructorNameById[event.instructorId]}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              );
            })}
        </div>
      </div>
    </div>
    </>
  );
}
