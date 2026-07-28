'use client';

import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltipContent, ChartLegendContent } from '@/components/ui/chart';
import { Payment } from '@/lib/types';
import { format, eachMonthOfInterval, eachDayOfInterval, endOfDay, startOfYear, endOfYear } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import { DateRangePicker } from './date-range-picker';
import { DateRange } from 'react-day-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getCollectedAmount, getEffectivePaymentStatus, getOutstandingAmount, isAdvanceCreditPayment } from '@/lib/payment-utils';

interface RevenueReportProps {
  payments: Payment[];
  statusFilter: 'all' | 'paid' | 'unpaid';
  dateRange: DateRange | undefined;
  setDateRange: (range: DateRange | undefined) => void;
}

export function RevenueReport({ payments, statusFilter, dateRange, setDateRange }: RevenueReportProps) {
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
      : dateFiltered.filter(p => getEffectivePaymentStatus(p) === statusFilter);

    const revenuePayments = statusFiltered.filter(payment => !isAdvanceCreditPayment(payment));
    const revenue = revenuePayments.reduce((sum, p) => sum + getCollectedAmount(p), 0);
    const cost = revenuePayments.reduce((sum, p) => sum + (p.totalCost || 0), 0);
    const profit = revenue - cost;

    const outstanding = revenuePayments.reduce((sum, p) => sum + getOutstandingAmount(p), 0);

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

      <Card className="overflow-hidden">
        <CardHeader className="space-y-4 border-b bg-muted/10 pb-5">
          <div>
            <CardTitle>Financial Overview</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Compare collected revenue, operating cost, and profit over time.</p>
          </div>
          <div className="grid gap-4 rounded-xl border bg-background p-3 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-start">
            <Select onValueChange={handleYearChange}>
              <SelectTrigger className="h-11 w-full">
                <SelectValue placeholder="Select year" />
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
        <CardContent className="p-4 pt-6 sm:p-6">
          {chartData.length === 0 ? (
            <div className="flex h-[300px] items-center justify-center rounded-xl border border-dashed bg-muted/10 text-center text-sm text-muted-foreground">
              Choose a date range to view financial activity.
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="h-[300px] w-full sm:h-[360px]">
              <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }} barGap={4} barCategoryGap="18%">
                  <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/60" />
                  <XAxis
                    dataKey="name"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    interval={chartData.length > 14 ? Math.floor(chartData.length / 8) : 0}
                    tickMargin={10}
                  />
                  <YAxis
                    width={58}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => value >= 1000 ? `$${(value / 1000).toFixed(1)}k` : `$${value}`}
                  />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted) / 0.45)' }}
                    content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value) || 0)} />}
                  />
                  <Legend verticalAlign="top" align="left" height={34} content={<ChartLegendContent />} />
                  <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[5, 5, 0, 0]} maxBarSize={24} />
                  <Bar dataKey="profit" fill="var(--color-profit)" radius={[5, 5, 0, 0]} maxBarSize={24} />
                  <Bar dataKey="cost" fill="var(--color-cost)" radius={[5, 5, 0, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
