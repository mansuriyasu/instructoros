'use client';

import { useState, useMemo } from 'react';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { Payment } from '@/lib/types';
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, eachDayOfInterval, subDays, startOfWeek, endOfWeek, startOfToday, endOfDay, startOfYear, endOfYear } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import { DateRangePicker } from './date-range-picker';
import { DateRange } from 'react-day-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { isAdvanceCreditPayment } from '@/lib/payment-utils';

interface RevenueReportProps {
  payments: Payment[];
  statusFilter: 'all' | 'paid' | 'unpaid';
  dateRange: DateRange | undefined;
  setDateRange: (range: DateRange | undefined) => void;
}

export function RevenueReport({ payments, statusFilter, dateRange, setDateRange }: RevenueReportProps) {
  const today = new Date();

  const { filteredPayments, totalRevenue, totalCost, netProfit, outstandingPayments } = useMemo(() => {
    if (!dateRange?.from) {
      return { filteredPayments: [], totalRevenue: 0, totalCost: 0, netProfit: 0, outstandingPayments: 0 };
    }
    const from = dateRange.from;
    const to = dateRange.to || dateRange.from;

    const dateFiltered = payments.filter(p => {
      if (statusFilter === 'unpaid') return true;
      const paymentDate = new Date(p.paymentDate);
      return paymentDate >= from && paymentDate <= endOfDay(to);
    });

    const statusFiltered = statusFilter === 'all'
      ? dateFiltered
      : dateFiltered.filter(p => p.status === statusFilter);

    const revenuePayments = statusFiltered.filter(payment => !isAdvanceCreditPayment(payment));
    const revenue = revenuePayments.reduce((sum, p) => sum + (p.paidAmount || 0), 0);
    const cost = revenuePayments.reduce((sum, p) => sum + (p.totalCost || 0), 0);
    const profit = revenue - cost;

    const outstanding = revenuePayments.reduce((sum, p) => sum + (p.amountDue || 0), 0);

    return { 
      filteredPayments: statusFiltered, 
      totalRevenue: revenue, 
      totalCost: cost,
      netProfit: profit,
      outstandingPayments: outstanding 
    };
  }, [payments, dateRange, statusFilter]);


  const chartData = useMemo(() => {
    if (!dateRange?.from) return [];
    
    const from = dateRange.from;
    const to = dateRange.to || from;
    const diffDays = (to.getTime() - from.getTime()) / (1000 * 3600 * 24);
    
    let interval: 'day' | 'month' | 'year';
    if (diffDays <= 31) interval = 'day';
    else if (diffDays <= 366) interval = 'month';
    else interval = 'year';

    const dataByUnit = filteredPayments.filter(payment => !isAdvanceCreditPayment(payment)).reduce((acc, p) => {
        const date = new Date(p.paymentDate);
        let unit: string;
        if (interval === 'day') unit = format(date, 'yyyy-MM-dd');
        else if (interval === 'month') unit = format(date, 'yyyy-MM');
        else unit = format(date, 'yyyy');
        
        if (!acc[unit]) acc[unit] = { revenue: 0, cost: 0, profit: 0 };

        acc[unit].revenue += p.paidAmount || 0;
        acc[unit].cost += (p.totalCost || 0);
        acc[unit].profit = acc[unit].revenue - acc[unit].cost;
        
        return acc;
    }, {} as Record<string, { revenue: number, cost: number, profit: number }>);
    
    // Ensure all units in the range are present for the chart
    if (interval === 'day') {
        const days = eachDayOfInterval({ start: from, end: to });
        days.forEach(day => {
            const dayKey = format(day, 'yyyy-MM-dd');
            if (!dataByUnit[dayKey]) dataByUnit[dayKey] = { revenue: 0, cost: 0, profit: 0 };
        });
    } else if (interval === 'month') {
        const months = eachMonthOfInterval({ start: from, end: to });
        months.forEach(month => {
            const monthKey = format(month, 'yyyy-MM');
            if (!dataByUnit[monthKey]) dataByUnit[monthKey] = { revenue: 0, cost: 0, profit: 0 };
        });
    }

    return Object.entries(dataByUnit)
        .map(([unit, totals]) => {
            let name;
            if (interval === 'day') name = format(new Date(unit), 'd');
            else if (interval === 'month') name = format(new Date(unit), 'MMM');
            else name = unit;
            return { name, date: new Date(unit), ...totals };
        })
        .sort((a,b) => a.date.getTime() - b.date.getTime());
  }, [filteredPayments, dateRange]);

  const chartConfig = {
    revenue: {
      label: 'Revenue',
      color: 'hsl(var(--chart-1))',
    },
    cost: {
      label: 'Cost',
      color: 'hsl(var(--chart-4))',
    },
    profit: {
        label: 'Profit',
        color: 'hsl(var(--chart-2))',
    }
  };

  const availableYears = useMemo(() => {
    if (!payments) return [];
    const years = new Set(payments.map(p => new Date(p.paymentDate).getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
  }, [payments]);

  const handleYearChange = (yearString: string) => {
    const year = parseInt(yearString, 10);
    if (!isNaN(year)) {
        const start = startOfYear(new Date(year, 0, 1));
        const end = endOfYear(new Date(year, 11, 31));
        setDateRange({ from: start, to: end });
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <span className="text-muted-foreground">$</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">For selected period</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <span className="text-muted-foreground">$</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalCost)}</div>
            <p className="text-xs text-muted-foreground">For selected period</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
            <span className="text-muted-foreground">$</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(netProfit)}</div>
            <p className="text-xs text-muted-foreground">For selected period</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
            <span className="text-muted-foreground">$</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(outstandingPayments)}</div>
            <p className="text-xs text-muted-foreground">For selected period</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 space-y-0 pb-2">
          <CardTitle>Financial Overview</CardTitle>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Select onValueChange={handleYearChange}>
                <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Select Year" />
                </SelectTrigger>
                <SelectContent>
                    {availableYears.map(year => (
                        <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <DateRangePicker dateRange={dateRange} setDateRange={setDateRange} />
          </div>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                <Tooltip content={<ChartTooltipContent formatter={(value, name) => `${formatCurrency(value as number)}`} />} />
                <Legend content={<ChartLegendContent />} />
                <Bar dataKey="profit" fill="var(--color-profit)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cost" fill="var(--color-cost)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
