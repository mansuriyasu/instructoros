'use client';

import * as React from 'react';
import { CalendarIcon, ChevronDown } from 'lucide-react';
import { format, startOfMonth, startOfToday, endOfMonth, subDays, startOfWeek, endOfWeek, startOfYear, endOfYear } from 'date-fns';
import { DateRange } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface DateRangePickerProps extends React.HTMLAttributes<HTMLDivElement> {
  dateRange: DateRange | undefined;
  setDateRange: (dateRange: DateRange | undefined) => void;
}

export function DateRangePicker({
  className,
  dateRange,
  setDateRange,
}: DateRangePickerProps) {

  const handlePresetChange = (value: string) => {
    const today = startOfToday();
    switch (value) {
      case 'today':
        setDateRange({ from: today, to: today });
        break;
      case 'yesterday':
        const yesterday = subDays(today, 1);
        setDateRange({ from: yesterday, to: yesterday });
        break;
      case 'this_week':
        setDateRange({ from: startOfWeek(today), to: endOfWeek(today) });
        break;
      case 'last_7_days':
        setDateRange({ from: subDays(today, 6), to: today });
        break;
      case 'this_month':
        setDateRange({ from: startOfMonth(today), to: endOfMonth(today) });
        break;
      case 'this_year':
        setDateRange({ from: startOfYear(today), to: endOfYear(today) });
        break;
      case 'all_time':
        setDateRange(undefined);
        break;
      default:
        break;
    }
  }

  return (
    <div className={cn('grid gap-2', className)}>
      <p className="text-sm font-semibold text-foreground">Report period</p>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={'outline'}
            className={cn(
              'h-12 w-full justify-between rounded-lg px-3 text-left font-normal sm:w-[320px]',
              !dateRange && 'text-muted-foreground'
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <CalendarIcon className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {dateRange?.from ? (
                  dateRange.to
                    ? `${format(dateRange.from, 'MMM d, yyyy')} - ${format(dateRange.to, 'MMM d, yyyy')}`
                    : format(dateRange.from, 'MMM d, yyyy')
                ) : 'Choose dates'}
              </span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[calc(100vw-2rem)] max-w-[380px] p-0" align="start" sideOffset={8}>
          <div className="border-b px-4 py-3">
            <p className="text-sm font-semibold">Choose a date range</p>
            <p className="mt-1 text-xs text-muted-foreground">Select the start date, then the end date.</p>
          </div>
          <div className="flex flex-col">
            <div className="border-b p-3">
                <Select onValueChange={handlePresetChange}>
                    <SelectTrigger className="h-11 w-full">
                        <SelectValue placeholder="Quick range" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="yesterday">Yesterday</SelectItem>
                        <SelectItem value="this_week">This Week</SelectItem>
                        <SelectItem value="last_7_days">Last 7 Days</SelectItem>
                        <SelectItem value="this_month">This Month</SelectItem>
                        <SelectItem value="this_year">This Year</SelectItem>
                        <SelectItem value="all_time">All Time</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={1}
                className="mx-auto w-full p-3"
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
