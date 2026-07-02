'use client';

import { useMemo } from 'react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { CalendarEvent } from '@/lib/types';
import { useEvents } from '@/hooks/use-events';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPinned, Navigation, Package, Route } from 'lucide-react';
import { cn, getServiceColorName } from '@/lib/utils';
import Link from 'next/link';

interface ListViewProps {
  currentDate: Date;
  onEventClick: (event: CalendarEvent) => void;
  searchQuery?: string;
}

export function ListView({ currentDate, onEventClick, searchQuery }: ListViewProps) {
  const dayStart = useMemo(() => startOfDay(currentDate), [currentDate]);
  const dayEnd = useMemo(() => endOfDay(currentDate), [currentDate]);

  const { events, loading } = useEvents(dayStart, dayEnd);

  const dayEvents = useMemo(() => {
    let filteredEvents = events;
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filteredEvents = events.filter(e => 
            e.studentName?.toLowerCase().includes(query) || 
            e.title?.toLowerCase().includes(query)
        );
    }
    return filteredEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }, [events, searchQuery]);

  const dayRouteUrl = useMemo(() => {
    const stops = dayEvents
      .filter(event => event.studentId && (event.lessonStatus || 'scheduled') !== 'cancelled')
      .map(event => event.studentAddress?.trim())
      .filter((address): address is string => Boolean(address))
      .filter((address, index, list) => index === 0 || address !== list[index - 1]);

    if (stops.length === 0) return null;
    if (stops.length === 1) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stops[0])}`;
    }

    return `https://www.google.com/maps/dir/${stops.map(stop => encodeURIComponent(stop)).join('/')}`;
  }, [dayEvents]);

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (dayEvents.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 px-5 py-14 text-center">
        <h3 className="text-lg font-semibold">No events scheduled</h3>
        <p className="mt-1 text-sm text-muted-foreground">There are no appointments for this day.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {dayRouteUrl && (
        <div className="flex justify-end">
          <Button asChild className="h-10 gap-2 rounded-lg bg-emerald-600 px-4 text-white hover:bg-emerald-700">
            <Link
              href={dayRouteUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open all scheduled stops for this day in Google Maps"
            >
              <MapPinned className="h-4 w-4" />
              <span>View my day</span>
            </Link>
          </Button>
        </div>
      )}
      {dayEvents.map(event => {
        const isBlocked = !event.studentId;
        const lessonStatus = event.lessonStatus || 'scheduled';
        const lessonStatusLabel = lessonStatus === 'no-show' ? 'No Show' : lessonStatus === 'cancelled' ? 'Cancelled' : null;
        const colorName = getServiceColorName(event.services?.[0]?.id);
        const wazeUrl = !isBlocked && event.studentAddress
          ? `https://waze.com/ul?q=${encodeURIComponent(event.studentAddress)}&navigate=yes`
          : null;

        return (
          <Card
            key={event.id}
            onClick={() => onEventClick(event)}
            className="cursor-pointer overflow-hidden rounded-lg border shadow-sm transition hover:shadow-md"
          >
            <CardContent className="flex p-0">
              <div className={cn("w-2", 
                isBlocked ? 'bg-slate-300' : lessonStatus === 'cancelled' ? 'bg-slate-400' : lessonStatus === 'no-show' ? 'bg-amber-500' : {
                  'bg-chart-1': colorName === 'chart-1',
                  'bg-chart-2': colorName === 'chart-2',
                  'bg-chart-3': colorName === 'chart-3',
                  'bg-chart-4': colorName === 'chart-4',
                  'bg-chart-5': colorName === 'chart-5',
                }
              )}></div>
              <div className="grid flex-1 grid-cols-[4.5rem_1fr_auto] gap-3 p-4 sm:grid-cols-[5rem_1fr_auto_auto_auto] sm:items-center">
                <div className="rounded-lg bg-muted/50 px-2 py-2 text-center">
                  <p className="text-lg font-bold leading-none">{format(new Date(event.start), 'h:mm')}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(event.start), 'a')}</p>
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-base leading-tight">
                      {event.studentName !== 'N/A' ? event.studentName : event.title}
                    </p>
                    {lessonStatusLabel && (
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                        lessonStatus === 'no-show' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'
                      )}>
                        {lessonStatusLabel}
                      </span>
                    )}
                  </div>
                  {event.services && event.services.length > 0 && (
                    <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                      <Package className="h-4 w-4" />
                      <span className="truncate">{event.services.map(s => s.name).join(', ')}</span>
                    </div>
                  )}
                </div>
                <div className="hidden text-right text-sm text-muted-foreground sm:block">
                    {format(new Date(event.end), 'h:mm a')}
                </div>
                <div className="flex items-center justify-end gap-2 sm:hidden">
                  {wazeUrl && (
                    <Link
                      href={wazeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(clickEvent) => clickEvent.stopPropagation()}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-600 text-white shadow-sm transition-colors hover:bg-sky-700"
                      aria-label="Open pickup address in Waze"
                      title="Open pickup in Waze"
                    >
                      <Navigation className="h-4 w-4" />
                    </Link>
                  )}
                </div>
                <div className="col-span-3 flex items-center justify-between text-sm text-muted-foreground sm:hidden">
                  <span>Ends {format(new Date(event.end), 'h:mm a')}</span>
                </div>
                {wazeUrl && (
                  <div className="hidden items-center justify-end sm:flex">
                    <Link
                      href={wazeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(clickEvent) => clickEvent.stopPropagation()}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-600 text-white shadow-sm transition-colors hover:bg-sky-700"
                      aria-label="Open pickup address in Waze"
                      title="Open pickup in Waze"
                    >
                      <Navigation className="h-4 w-4" />
                    </Link>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  );
}
