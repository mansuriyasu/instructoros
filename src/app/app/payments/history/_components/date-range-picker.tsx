'use client';

import * as React from 'react';
import { format, parse, startOfMonth, startOfToday, endOfMonth, subDays, startOfWeek, endOfWeek, startOfYear, endOfYear, isValid, startOfDay, endOfDay } from 'date-fns';
import { DateRange } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
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

  const inputDate = (date?: Date) => date ? format(date, 'yyyy-MM-dd') : '';

  const updateFrom = (value: string) => {
    if (!value) {
      setDateRange(undefined);
      return;
    }
    const from = parse(value, 'yyyy-MM-dd', new Date());
    if (!isValid(from)) return;
    const existingTo = dateRange?.to;
    setDateRange({
      from: startOfDay(from),
      to: existingTo && existingTo >= from ? endOfDay(existingTo) : endOfDay(from),
    });
  };

  const updateTo = (value: string) => {
    if (!value || !dateRange?.from) return;
    const to = parse(value, 'yyyy-MM-dd', new Date());
    if (!isValid(to)) return;
    const safeTo = to < dateRange.from ? dateRange.from : to;
    setDateRange({ from: dateRange.from, to: endOfDay(safeTo) });
  };

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
    <div className={cn('grid gap-3', className)}>
      <div>
        <p className="text-sm font-semibold text-foreground">Report period</p>
        <p className="mt-1 text-xs text-muted-foreground">Choose the first and last day to include.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-medium">
          From
          <Input
            type="date"
            value={inputDate(dateRange?.from)}
            onChange={(event) => updateFrom(event.target.value)}
            className="h-12 w-full text-base [color-scheme:light]"
            aria-label="Report start date"
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          To
          <Input
            type="date"
            value={inputDate(dateRange?.to)}
            onChange={(event) => updateTo(event.target.value)}
            className="h-12 w-full text-base [color-scheme:light]"
            aria-label="Report end date"
            disabled={!dateRange?.from}
          />
        </label>
      </div>
      <Select onValueChange={handlePresetChange}>
        <SelectTrigger className="h-11 w-full sm:w-[220px]">
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
  );
}
