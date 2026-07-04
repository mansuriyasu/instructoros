'use client';

import { useMemo, useState, useEffect } from 'react';
import {
  format,
  setHours,
  startOfDay,
  endOfDay,
  isSameDay
} from 'date-fns';
import { cn, getServiceColorName } from '@/lib/utils';
import { CalendarEvent } from '@/lib/types';
import { useEvents } from '@/hooks/use-events';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, MapPin, Navigation, Package, UserRound } from 'lucide-react';

interface DayViewProps {
  currentDate: Date;
  onEventClick: (event: CalendarEvent) => void;
  onSlotClick: (date: Date) => void;
  onEventDrop: (eventId: string, newStart: Date, newEnd: Date) => void;
  searchQuery?: string;
  selectedInstructorId?: string;
  instructorNameById?: Record<string, string>;
}

const HOUR_HEIGHT_IN_PIXELS = 100;

export function DayView({ currentDate, onEventClick, onSlotClick, onEventDrop, searchQuery, selectedInstructorId = 'all', instructorNameById = {} }: DayViewProps) {
  const dayStart = useMemo(() => startOfDay(currentDate), [currentDate]);
  const dayEnd = useMemo(() => endOfDay(currentDate), [currentDate]);
  
  const { events, loading } = useEvents(dayStart, dayEnd);

  const [dragOverSlot, setDragOverSlot] = useState<Date | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  
  const dayEvents = useMemo(() => {
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
    return filteredEvents.sort((a,b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }, [events, instructorNameById, searchQuery, selectedInstructorId]);

  const hours = Array.from({ length: 14 }, (_, i) => i + 8); // 8 AM to 9 PM
  
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

  const currentTimePosition = (currentTime.getHours() - 8 + currentTime.getMinutes() / 60) * HOUR_HEIGHT_IN_PIXELS;

  if (loading) {
    return (
      <div className="rounded-lg border p-4">
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  const renderEventContent = (event: CalendarEvent, compact = false) => {
    const start = new Date(event.start);
    const end = new Date(event.end);
    const lessonStatus = event.lessonStatus || 'scheduled';
    const lessonStatusLabel = lessonStatus === 'no-show' ? 'No Show' : lessonStatus === 'cancelled' ? 'Cancelled' : null;
    const wazeUrl = event.studentId && event.studentAddress
      ? `https://waze.com/ul?q=${encodeURIComponent(event.studentAddress)}&navigate=yes`
      : null;

    return (
      <>
        <div className="flex items-start gap-2">
          <p className={cn("min-w-0 flex-1 truncate font-semibold", compact ? "text-sm" : "text-base")}>
            {event.studentName !== 'N/A' ? event.studentName : event.title}
          </p>
          {lessonStatusLabel && (
            <span className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
              lessonStatus === 'no-show' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'
            )}>
              {lessonStatusLabel}
            </span>
          )}
          {wazeUrl && (
            <a
              href={wazeUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(clickEvent) => clickEvent.stopPropagation()}
              className={cn(
                "flex shrink-0 items-center justify-center rounded-full bg-sky-600 text-white shadow-sm transition-colors hover:bg-sky-700",
                compact ? "h-7 w-7" : "h-9 w-9"
              )}
              aria-label="Open pickup address in Waze"
              title="Open pickup in Waze"
            >
              <Navigation className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
            </a>
          )}
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-xs opacity-90">
          <Clock className="h-3.5 w-3.5" />
          <span>{format(start, 'h:mm a')} - {format(end, 'h:mm a')}</span>
        </div>
        {event.services && event.services.length > 0 && (
          <div className="mt-1 flex items-center gap-1.5 text-xs opacity-85">
            <Package className="h-3.5 w-3.5" />
            <span className="truncate">{event.services.map(s => s.name).join(', ')}</span>
          </div>
        )}
        {event.instructorId && instructorNameById[event.instructorId] && (
          <div className="mt-1 flex items-center gap-1.5 text-xs opacity-85">
            <UserRound className="h-3.5 w-3.5" />
            <span className="truncate">{instructorNameById[event.instructorId]}</span>
          </div>
        )}
        {!compact && event.studentAddress && (
          <div className="mt-1 flex items-center gap-1.5 text-xs opacity-80">
            <MapPin className="h-3.5 w-3.5" />
            <span className="truncate">{event.studentAddress}</span>
          </div>
        )}
      </>
    );
  };

  const eventColorClass = (event: CalendarEvent) => {
    const isBlocked = !event.studentId;
    const lessonStatus = event.lessonStatus || 'scheduled';
    const colorName = getServiceColorName(event.services?.[0]?.id);

    if (isBlocked) return 'border-slate-300 bg-slate-100 text-slate-700';
    if (lessonStatus === 'cancelled') return 'border-slate-400 bg-slate-100 text-slate-600';
    if (lessonStatus === 'no-show') return 'border-amber-500 bg-amber-100 text-amber-900';

    return {
      'border-chart-1 bg-chart-1/90 text-primary-foreground': colorName === 'chart-1',
      'border-chart-2 bg-chart-2/90 text-primary-foreground': colorName === 'chart-2',
      'border-chart-3 bg-chart-3/90 text-primary-foreground': colorName === 'chart-3',
      'border-chart-4 bg-chart-4/90 text-primary-foreground': colorName === 'chart-4',
      'border-chart-5 bg-chart-5/90 text-black': colorName === 'chart-5',
    };
  };

  return (
    <>
      <div className="space-y-3 md:hidden">
        {dayEvents.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/20 px-5 py-12 text-center">
            <h3 className="font-semibold">No appointments today</h3>
            <p className="mt-1 text-sm text-muted-foreground">Tap Add to create one.</p>
          </div>
        ) : (
          dayEvents.map(event => (
            <div
              key={event.id}
              role="button"
              tabIndex={0}
              onClick={() => onEventClick(event)}
              onKeyDown={(keyboardEvent) => {
                if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
                  keyboardEvent.preventDefault();
                  onEventClick(event);
                }
              }}
              className={cn(
                "w-full rounded-lg border-l-4 p-4 text-left shadow-sm transition active:scale-[0.99]",
                eventColorClass(event)
              )}
            >
              {renderEventContent(event)}
            </div>
          ))
        )}
      </div>

      <div className="hidden overflow-auto rounded-lg border bg-background md:block">
        <div className="relative grid grid-cols-[4.5rem_1fr]">
        {hours.map((hour, hourIndex) => {
          const slotDate = setHours(currentDate, hour);
          return (
            <div
              key={hour}
              className="col-start-1 col-end-3 grid grid-cols-[4.5rem_1fr] border-t first:border-t-0"
            >
              <div className="pr-3 pt-2 text-right">
                <span className="text-xs text-muted-foreground">{format(slotDate, 'h a')}</span>
              </div>
              <div 
                className={cn(
                  "h-20 cursor-pointer border-l transition-colors hover:bg-muted/40",
                  hourIndex % 2 === 0 ? 'bg-muted/15' : '',
                  dragOverSlot && dragOverSlot.getHours() === hour && 'bg-accent/60'
                )}
                onClick={() => onSlotClick(slotDate)}
                onDragOver={(e) => handleDragOver(e, slotDate)}
                onDrop={(e) => handleDrop(e, slotDate)}
                onDragLeave={() => setDragOverSlot(null)}
                style={{ height: `${HOUR_HEIGHT_IN_PIXELS}px` }}
              ></div>
            </div>
          );
        })}

        {isSameDay(currentDate, currentTime) && currentTimePosition >= 0 && (
          <div className="absolute left-[4.5rem] right-0 z-10 h-px bg-red-500" style={{ top: currentTimePosition }}>
              <div className="absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full bg-red-500" />
          </div>
        )}

        <div className="col-start-2 col-end-3 row-start-1 row-end-[-1] relative">
          {dayEvents.map(event => {
            const start = new Date(event.start);
            const end = new Date(event.end);
            
            const startMinutes = (start.getHours() - 8) * 60 + start.getMinutes();
            const top = (startMinutes / 60) * HOUR_HEIGHT_IN_PIXELS;

            const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
            const height = Math.max(30, (durationMinutes / 60) * HOUR_HEIGHT_IN_PIXELS);

            return (
              <div
                key={event.id}
                draggable
                onDragStart={(e) => handleDragStart(e, event)}
                className={cn(
                  "absolute left-3 w-[calc(100%-1.5rem)] cursor-pointer overflow-hidden rounded-lg border-l-4 p-2.5 shadow-sm transition-all hover:z-20 hover:shadow-md",
                  eventColorClass(event)
                )}
                style={{ top: `${top}px`, height: `${height}px` }}
                onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
              >
                {renderEventContent(event, true)}
              </div>
            );
          })}
        </div>
        </div>
      </div>
    </>
  );
}
