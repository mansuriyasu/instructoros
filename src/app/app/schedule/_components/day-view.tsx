'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import {
  format,
  setHours,
  startOfDay,
  endOfDay,
  isSameDay,
  addMinutes,
  differenceInMinutes
} from 'date-fns';
import { cn, getServiceColorName } from '@/lib/utils';
import { CalendarEvent } from '@/lib/types';
import { useEvents } from '@/hooks/use-events';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, MapPin, Navigation, Package, UserRound, Sparkles, AlertTriangle, CheckCircle2, Car, Route } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AiSchedulePreview } from './ai-schedule-preview';
import { getAuthenticatedHeaders } from '@/lib/authenticated-fetch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface DayViewProps {
  currentDate: Date;
  onEventClick: (event: CalendarEvent) => void;
  onSlotClick: (date: Date) => void;
  onEventDrop: (eventId: string, newStart: Date, newEnd: Date) => void;
  onRescheduleEvents?: (updates: Array<{ id: string; start: string; end: string }>) => Promise<void>;
  selectedInstructorId?: string;
  instructorNameById?: Record<string, string>;
}

const HOUR_HEIGHT_IN_PIXELS = 100;
const SAFE_BUFFER_MINUTES = 5;

type TravelSegment = {
  fromEventId: string;
  toEventId: string;
  travelMinutes: number;
  gapMinutes: number;
  requiredMinutes: number;
  delayMinutes: number;
  ok: boolean;
};

type RescheduleUpdate = {
  id: string;
  studentName: string;
  oldStart: string;
  oldEnd: string;
  newStart: string;
  newEnd: string;
};

type ReschedulePreview = {
  conflict: TravelSegment;
  updates: RescheduleUpdate[];
} | null;

export function DayView({ currentDate, onEventClick, onSlotClick, onEventDrop, onRescheduleEvents, selectedInstructorId = 'all', instructorNameById = {} }: DayViewProps) {
  const dayStart = useMemo(() => startOfDay(currentDate), [currentDate]);
  const dayEnd = useMemo(() => endOfDay(currentDate), [currentDate]);

  const { events, loading } = useEvents(dayStart, dayEnd);

  const [dragOverSlot, setDragOverSlot] = useState<Date | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showAiPreview, setShowAiPreview] = useState(false);
  const [travelSegments, setTravelSegments] = useState<TravelSegment[]>([]);
  const [isCheckingTravel, setIsCheckingTravel] = useState(false);
  const [reschedulePreview, setReschedulePreview] = useState<ReschedulePreview>(null);
  const [isApplyingReschedule, setIsApplyingReschedule] = useState(false);
  const travelCacheRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const dayEvents = useMemo(() => {
    let filteredEvents = events;
    if (selectedInstructorId !== 'all') {
      filteredEvents = filteredEvents.filter(event => event.instructorId === selectedInstructorId);
    }
    return filteredEvents.sort((a,b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }, [events, selectedInstructorId]);

  const routeEvents = useMemo(() => {
    return dayEvents.filter(event => event.studentId && (event.lessonStatus || 'scheduled') !== 'cancelled');
  }, [dayEvents]);

  useEffect(() => {
    let cancelled = false;

    const estimateTravelMinutes = async (origin?: string, destination?: string) => {
      if (!origin?.trim() || !destination?.trim()) return null;
      const cacheKey = `${origin.trim().toLowerCase()}__${destination.trim().toLowerCase()}`;
      const cached = travelCacheRef.current.get(cacheKey);
      if (cached !== undefined) return cached;

      try {
        const response = await fetch('/api/travel-time', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(await getAuthenticatedHeaders()) },
          body: JSON.stringify({ origin, destination }),
        });
        const result = await response.json();
        const minutes = result.ok && Number.isFinite(Number(result.details?.travelTimeMinutes))
          ? Math.max(0, Math.round(Number(result.details.travelTimeMinutes)))
          : null;
        if (minutes !== null) travelCacheRef.current.set(cacheKey, minutes);
        return minutes;
      } catch {
        return null;
      }
    };

    const checkRoute = async () => {
      if (routeEvents.length < 2) {
        setTravelSegments([]);
        return;
      }

      setIsCheckingTravel(true);
      const segments: TravelSegment[] = [];

      for (let index = 1; index < routeEvents.length; index += 1) {
        const previous = routeEvents[index - 1];
        const current = routeEvents[index];
        const travelMinutes = await estimateTravelMinutes(previous.studentAddress, current.studentAddress);
        if (cancelled) return;
        if (travelMinutes === null) continue;

        const previousEnd = new Date(previous.end);
        const currentStart = new Date(current.start);
        const gapMinutes = Math.max(0, differenceInMinutes(currentStart, previousEnd));
        const requiredMinutes = travelMinutes + SAFE_BUFFER_MINUTES;
        const delayMinutes = Math.max(0, requiredMinutes - gapMinutes);

        segments.push({
          fromEventId: previous.id,
          toEventId: current.id,
          travelMinutes,
          gapMinutes,
          requiredMinutes,
          delayMinutes,
          ok: delayMinutes === 0,
        });
      }

      if (!cancelled) {
        setTravelSegments(segments);
        setIsCheckingTravel(false);
      }
    };

    void checkRoute();

    return () => {
      cancelled = true;
    };
  }, [routeEvents]);

  const conflictSegments = useMemo(() => travelSegments.filter(segment => !segment.ok), [travelSegments]);
  const firstConflict = conflictSegments[0];
  const totalDriveMinutes = useMemo(() => travelSegments.reduce((sum, segment) => sum + segment.travelMinutes, 0), [travelSegments]);
  const onTimeLessonCount = Math.max(0, routeEvents.length - conflictSegments.length);

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

  const getIncomingSegment = (eventId: string) => travelSegments.find(segment => segment.toEventId === eventId);

  const getEventRouteState = (event: CalendarEvent) => {
    const lessonStatus = event.lessonStatus || 'scheduled';
    if (lessonStatus === 'cancelled') return 'cancelled';
    if (lessonStatus === 'no-show') return 'warning';
    const incoming = getIncomingSegment(event.id);
    if (!incoming) return 'normal';
    if (!incoming.ok) return incoming.delayMinutes >= 15 ? 'conflict' : 'warning';
    return 'ok';
  };

  const buildReschedulePreview = (conflict: TravelSegment) => {
    const startIndex = routeEvents.findIndex(event => event.id === conflict.toEventId);
    if (startIndex < 0) return;

    const updates: RescheduleUpdate[] = [];
    const newTimes = new Map<string, { start: Date; end: Date }>();

    for (let index = startIndex; index < routeEvents.length; index += 1) {
      const event = routeEvents[index];
      const oldStart = new Date(event.start);
      const oldEnd = new Date(event.end);
      const duration = Math.max(1, differenceInMinutes(oldEnd, oldStart));

      let nextStart = oldStart;
      const previous = routeEvents[index - 1];

      if (previous) {
        const previousTimes = newTimes.get(previous.id);
        const previousEnd = previousTimes?.end || new Date(previous.end);
        const segment = travelSegments.find(item => item.fromEventId === previous.id && item.toEventId === event.id);
        const earliestStart = addMinutes(previousEnd, (segment?.travelMinutes || 0) + SAFE_BUFFER_MINUTES);
        if (nextStart < earliestStart) nextStart = earliestStart;
      }

      const nextEnd = addMinutes(nextStart, duration);
      newTimes.set(event.id, { start: nextStart, end: nextEnd });

      if (nextStart.getTime() !== oldStart.getTime() || nextEnd.getTime() !== oldEnd.getTime()) {
        updates.push({
          id: event.id,
          studentName: event.studentName !== 'N/A' ? event.studentName : event.title,
          oldStart: oldStart.toISOString(),
          oldEnd: oldEnd.toISOString(),
          newStart: nextStart.toISOString(),
          newEnd: nextEnd.toISOString(),
        });
      }
    }

    setReschedulePreview({ conflict, updates });
  };

  const renderEventContent = (event: CalendarEvent, compact = false) => {
    const start = new Date(event.start);
    const end = new Date(event.end);
    const lessonStatus = event.lessonStatus || 'scheduled';
    const lessonStatusLabel = lessonStatus === 'no-show' ? 'No Show' : lessonStatus === 'cancelled' ? 'Cancelled' : null;
    const incomingSegment = getIncomingSegment(event.id);
    const routeState = getEventRouteState(event);
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
          {!compact && routeState === 'conflict' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(clickEvent) => {
                clickEvent.stopPropagation();
                if (incomingSegment) buildReschedulePreview(incomingSegment);
              }}
              className="h-8 shrink-0 rounded-full border-red-200 bg-red-50 px-3 text-xs font-bold text-red-700 hover:bg-red-100"
            >
              Reschedule
            </Button>
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
          <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs opacity-80">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 truncate" title={event.studentAddress}>{event.studentAddress}</span>
          </div>
        )}
        {!compact && incomingSegment && !incomingSegment.ok && (
          <div className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
            Will be {incomingSegment.delayMinutes} min late due to travel time.
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

    const routeState = getEventRouteState(event);
    if (routeState === 'conflict') return 'border-red-500 bg-red-50 text-red-950';
    if (routeState === 'warning') return 'border-amber-500 bg-amber-50 text-amber-950';
    if (routeState === 'ok') return 'border-emerald-500 bg-emerald-50 text-emerald-950';

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
        {firstConflict && (
          <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-orange-700">{conflictSegments.length} Conflict {conflictSegments.length === 1 ? 'Found' : 'Found'}</p>
                <p className="mt-1 text-sm text-orange-900/80">
                  Travel time ({firstConflict.travelMinutes} min) needs {firstConflict.requiredMinutes} min with buffer, but only {firstConflict.gapMinutes} min is available.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => buildReschedulePreview(firstConflict)}
                className="h-9 shrink-0 rounded-xl bg-orange-600 px-3 text-xs font-bold text-white hover:bg-orange-700"
              >
                Resolve Now
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-4 gap-2 rounded-2xl border bg-card p-3 shadow-sm">
          <div className="min-w-0 text-center">
            <Clock className="mx-auto mb-1 h-5 w-5 text-blue-600" />
            <p className="text-[10px] font-semibold text-muted-foreground">Lessons</p>
            <p className="text-sm font-bold">{routeEvents.length}</p>
          </div>
          <div className="min-w-0 text-center">
            <CheckCircle2 className="mx-auto mb-1 h-5 w-5 text-emerald-600" />
            <p className="text-[10px] font-semibold text-muted-foreground">On time</p>
            <p className="text-sm font-bold">{isCheckingTravel ? '...' : onTimeLessonCount}</p>
          </div>
          <div className="min-w-0 text-center">
            <AlertTriangle className="mx-auto mb-1 h-5 w-5 text-orange-600" />
            <p className="text-[10px] font-semibold text-muted-foreground">Conflicts</p>
            <p className="text-sm font-bold">{isCheckingTravel ? '...' : conflictSegments.length}</p>
          </div>
          <div className="min-w-0 text-center">
            <Route className="mx-auto mb-1 h-5 w-5 text-indigo-600" />
            <p className="text-[10px] font-semibold text-muted-foreground">Drive</p>
            <p className="text-sm font-bold">{Math.floor(totalDriveMinutes / 60)}h {totalDriveMinutes % 60}m</p>
          </div>
        </div>

        <div className="rounded-2xl border bg-card px-4 py-3 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {format(currentDate, 'EEEE')}
              </p>
              <h2 className="text-lg font-bold">{format(currentDate, 'MMMM d')}</h2>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAiPreview(true)}
                className="rounded-full text-indigo-600 border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100 h-8 text-xs whitespace-nowrap"
              >
                <Sparkles className="h-3 w-3 mr-1" />
                AI Schedule
              </Button>
              <div className="rounded-full bg-muted px-3 py-1 text-sm font-semibold text-muted-foreground flex items-center">
                {dayEvents.length} {dayEvents.length === 1 ? 'event' : 'events'}
              </div>
            </div>
          </div>
        </div>

        {dayEvents.length === 0 ? (
          <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="border-b px-4 py-4">
              <h3 className="font-semibold">No appointments today</h3>
              <p className="mt-1 text-sm text-muted-foreground">Tap a time below to add a lesson.</p>
            </div>
            <div className="divide-y">
              {hours.slice(0, 10).map(hour => {
                const slotDate = setHours(currentDate, hour);

                return (
                  <button
                    key={hour}
                    type="button"
                    onClick={() => onSlotClick(slotDate)}
                    className="grid w-full grid-cols-[4.25rem_1fr] items-center gap-3 px-4 py-3 text-left active:bg-muted/70"
                  >
                    <span className="text-xs font-semibold text-muted-foreground">{format(slotDate, 'h a')}</span>
                    <span className="rounded-xl border border-dashed bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                      Add appointment
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="divide-y">
              {dayEvents.map((event, index) => {
                const start = new Date(event.start);
                const previousEvent = dayEvents[index - 1];
                const showTime = !previousEvent || !isSameDay(new Date(previousEvent.start), start) || format(new Date(previousEvent.start), 'h:mm a') !== format(start, 'h:mm a');
                const outgoingSegment = travelSegments.find(segment => segment.fromEventId === event.id);

                return (
                  <div key={event.id}>
                  <div className="grid grid-cols-[4.25rem_1fr] gap-3 px-4 py-3">
                    <div className="pt-1 text-right">
                      {showTime && (
                        <>
                          <p className="text-sm font-bold">{format(start, 'h:mm')}</p>
                          <p className="text-[11px] font-semibold uppercase text-muted-foreground">{format(start, 'a')}</p>
                        </>
                      )}
                    </div>
                    <div className="relative min-w-0 pl-4">
                      <span className="absolute bottom-0 left-0 top-0 w-px bg-border" />
                      <span className="absolute left-[-4px] top-4 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />
                      <div
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
                          "w-full min-w-0 overflow-hidden rounded-2xl border-l-4 p-3 text-left shadow-sm transition active:scale-[0.99]",
                          eventColorClass(event)
                        )}
                      >
                        {renderEventContent(event)}
                      </div>
                    </div>
                  </div>
                  {outgoingSegment && (
                    <div className="grid grid-cols-[4.25rem_1fr] gap-3 px-4 pb-2">
                      <div className="flex justify-end pt-1">
                        <div className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-full border bg-background shadow-sm",
                          outgoingSegment.ok ? "text-emerald-600" : "text-red-600"
                        )}>
                          <Car className="h-3.5 w-3.5" />
                        </div>
                      </div>
                      <div className={cn(
                        "flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold",
                        outgoingSegment.ok ? "bg-muted/50 text-muted-foreground" : "bg-red-50 text-red-700"
                      )}>
                        <span>Travel to next: {outgoingSegment.travelMinutes} min + {SAFE_BUFFER_MINUTES} min buffer</span>
                        <span>{outgoingSegment.ok ? `Gap ${outgoingSegment.gapMinutes} min` : `${outgoingSegment.delayMinutes} min late`}</span>
                      </div>
                    </div>
                  )}
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => onSlotClick(new Date(currentDate))}
              className="flex w-full items-center justify-center gap-2 border-t bg-muted/20 px-4 py-4 text-sm font-semibold text-primary active:bg-muted"
            >
              Add another appointment
            </button>
          </div>
        )}
      </div>

      <div className="hidden md:flex justify-end mb-4">
              <Button
          variant="outline"
          onClick={() => setShowAiPreview(true)}
          className="rounded-full text-indigo-600 border-indigo-200 bg-indigo-50 hover:bg-indigo-100 hover:text-indigo-700 shadow-sm transition-all"
        >
          <Sparkles className="h-4 w-4 mr-2 text-indigo-500" />
          Auto-Schedule Day (AI)
        </Button>
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
                  "absolute left-3 min-w-0 w-[calc(100%-1.5rem)] cursor-pointer overflow-hidden rounded-lg border-l-4 p-2.5 shadow-sm transition-all hover:z-20 hover:shadow-md",
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

      {showAiPreview && (
        <AiSchedulePreview
          currentDate={currentDate}
          selectedInstructorId={selectedInstructorId}
          onClose={() => setShowAiPreview(false)}
        />
      )}

      <AlertDialog open={!!reschedulePreview} onOpenChange={(open) => !open && setReschedulePreview(null)}>
        <AlertDialogContent className="w-[calc(100%-1rem)] max-w-lg overflow-hidden rounded-2xl p-0">
          <AlertDialogHeader className="border-b bg-orange-50 px-5 py-5 text-left">
            <AlertDialogTitle className="text-xl">Preview safer timing</AlertDialogTitle>
            <AlertDialogDescription>
              This will move the conflict lesson and any later lessons needed to keep ETA plus a {SAFE_BUFFER_MINUTES}-minute buffer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-[55vh] space-y-3 overflow-y-auto px-5 py-4">
            {reschedulePreview?.updates.length ? (
              reschedulePreview.updates.map(update => (
                <div key={update.id} className="rounded-xl border bg-card p-3">
                  <p className="font-semibold">{update.studentName}</p>
                  <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground line-through">
                      {format(new Date(update.oldStart), 'h:mm a')} - {format(new Date(update.oldEnd), 'h:mm a')}
                    </span>
                    <span className="font-bold text-emerald-700">
                      {format(new Date(update.newStart), 'h:mm a')} - {format(new Date(update.newEnd), 'h:mm a')}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">No timing changes are needed.</p>
            )}
          </div>
          <AlertDialogFooter className="border-t px-5 py-4 sm:flex-row">
            <AlertDialogCancel className="mt-0 rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!reschedulePreview?.updates.length || isApplyingReschedule}
              className="rounded-xl bg-primary text-primary-foreground"
              onClick={async () => {
                if (!reschedulePreview?.updates.length || !onRescheduleEvents) return;
                setIsApplyingReschedule(true);
                try {
                  await onRescheduleEvents(reschedulePreview.updates.map(update => ({
                    id: update.id,
                    start: update.newStart,
                    end: update.newEnd,
                  })));
                  setReschedulePreview(null);
                } finally {
                  setIsApplyingReschedule(false);
                }
              }}
            >
              Apply changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
