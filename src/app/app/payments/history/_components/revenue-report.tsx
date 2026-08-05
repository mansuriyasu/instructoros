'use client';

import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartLegendContent, ChartTooltipContent } from '@/components/ui/chart';
import { Payment } from '@/lib/types';
import { eachDayOfInterval, eachMonthOfInterval, endOfDay, endOfMonth, format, startOfDay, startOfMonth } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import { DateRange } from 'react-day-picker';
import { getCollectedAmount, getEffectivePaymentStatus, isAdvanceCreditPayment } from '@/lib/payment-utils';

interface RevenueReportProps {
  payments: Payment[];
  statusFilter: 'all' | 'paid' | 'unpaid';
  dateRange: DateRange | undefined;
}

export function RevenueReport({ payments, statusFilter, dateRange }: RevenueReportProps) {
  const filteredPayments = useMemo(() => {
    const from = dateRange?.from ? startOfDay(dateRange.from) : null;
    const to = dateRange?.to ? endOfDay(dateRange.to) : from ? endOfDay(from) : null;

    return payments.filter(payment => {
      const paymentDate = new Date(payment.paymentDate);
      const inRange = !Number.isNaN(paymentDate.getTime()) && (!from || !to || (paymentDate >= from && paymentDate <= to));
      if (!inRange) return false;
      return statusFilter === 'all' || getEffectivePaymentStatus(payment) === statusFilter;
    });
  }, [payments, dateRange, statusFilter]);

  const chartRange = useMemo(() => {
    if (dateRange?.from) {
      return {
        from: startOfDay(dateRange.from),
        to: endOfDay(dateRange.to || dateRange.from),
      };
    }

    const dates = filteredPayments
      .map(payment => new Date(payment.paymentDate))
      .filter(date => !Number.isNaN(date.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());
    if (dates.length === 0) return null;
    return { from: startOfMonth(dates[0]), to: endOfMonth(dates[dates.length - 1]) };
  }, [dateRange, filteredPayments]);

  const chartData = useMemo(() => {
    if (!chartRange) return [];

    const diffDays = (chartRange.to.getTime() - chartRange.from.getTime()) / (1000 * 3600 * 24);
    const interval: 'day' | 'month' | 'year' = diffDays <= 31 ? 'day' : diffDays <= 366 ? 'month' : 'year';
    const dataByUnit = filteredPayments
      .filter(payment => !isAdvanceCreditPayment(payment))
      .reduce((acc, payment) => {
        const date = new Date(payment.paymentDate);
        if (Number.isNaN(date.getTime())) return acc;
        const unit = interval === 'day'
          ? format(date, 'yyyy-MM-dd')
          : interval === 'month'
            ? format(date, 'yyyy-MM')
            : format(date, 'yyyy');
        if (!acc[unit]) acc[unit] = { profit: 0, cost: 0 };
        const cost = Number.isFinite(payment.totalCost) ? payment.totalCost : 0;
        acc[unit].cost += cost;
        acc[unit].profit += getCollectedAmount(payment) - cost;
        return acc;
      }, {} as Record<string, { profit: number; cost: number }>);

    if (interval === 'day') {
      eachDayOfInterval({ start: chartRange.from, end: chartRange.to }).forEach(day => {
        const key = format(day, 'yyyy-MM-dd');
        if (!dataByUnit[key]) dataByUnit[key] = { profit: 0, cost: 0 };
      });
    } else if (interval === 'month') {
      eachMonthOfInterval({ start: chartRange.from, end: chartRange.to }).forEach(month => {
        const key = format(month, 'yyyy-MM');
        if (!dataByUnit[key]) dataByUnit[key] = { profit: 0, cost: 0 };
      });
    }

    return Object.entries(dataByUnit)
      .map(([unit, totals]) => {
        const date = interval === 'day'
          ? new Date(`${unit}T00:00:00`)
          : interval === 'month'
            ? new Date(`${unit}-01T00:00:00`)
            : new Date(`${unit}-01-01T00:00:00`);
        return {
          name: interval === 'day' ? format(date, 'd') : interval === 'month' ? format(date, 'MMM') : unit,
          date,
          ...totals,
        };
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [chartRange, filteredPayments]);

  const chartConfig = {
    profit: { label: 'Net profit', color: 'hsl(var(--chart-1))' },
    cost: { label: 'Recorded costs', color: 'hsl(var(--chart-4))' },
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/10 pb-4">
        <CardTitle>Profit trend</CardTitle>
        <p className="text-sm text-muted-foreground">Compare net profit with recorded bill costs over time.</p>
      </CardHeader>
      <CardContent className="p-4 pt-6 sm:p-6">
        {chartData.length === 0 ? (
          <div className="flex h-[240px] items-center justify-center rounded-xl border border-dashed bg-muted/10 text-center text-sm text-muted-foreground">
            No payment activity in this period yet.
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[240px] w-full sm:h-[320px]">
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
                  width={54}
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
                <Bar dataKey="profit" fill="var(--color-profit)" radius={[5, 5, 0, 0]} maxBarSize={28} />
                <Bar dataKey="cost" fill="var(--color-cost)" radius={[5, 5, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
