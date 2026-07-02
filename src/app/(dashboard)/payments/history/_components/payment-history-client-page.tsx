'use client';

import { usePayments } from '@/hooks/use-payments';
import { useEvents } from '@/hooks/use-events';
import { Payment, PaymentMethod, PaymentStatus } from '@/lib/types';
import { RevenueReport } from './revenue-report';
import { PaymentsDataTable } from './payments-data-table';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useMemo, useState } from 'react';
import { PaymentDetailsDialog } from './payment-details-dialog';
import { RecordPaymentDialog } from './record-payment-dialog';
import { DateRangePicker } from './date-range-picker';
import { formatCurrency } from '@/lib/utils';
import { Banknote, CircleDollarSign, ReceiptText, WalletCards, Eye, EyeOff, CalendarDays, CalendarCheck } from 'lucide-react';
import { calculateAmountDue, calculatePaymentStatus, createPaymentTransaction, isAdvanceCreditPayment } from '@/lib/payment-utils';
import { Button } from '@/components/ui/button';
import { startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from 'date-fns';
import { DateRange } from 'react-day-picker';

export function PaymentHistoryClientPage() {
  const { payments, loading, updatePayment, deletePayment } = usePayments();
  const { events, updateEvent } = useEvents();
  const { toast } = useToast();
  
  const today = new Date();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(today),
    to: endOfMonth(today),
  });

  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [isTotalsHidden, setIsTotalsHidden] = useState(true);

  const paymentSummary = useMemo(() => {
    const safePayments = payments || [];
    const now = new Date();
    
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));
    const currentYearStart = startOfYear(now);
    const currentYearEnd = endOfYear(now);

    let thisMonthSales = 0;
    let lastMonthSales = 0;
    let thisYearSales = 0;
    let totalOutstanding = 0;

    safePayments.forEach(payment => {
      totalOutstanding += payment.amountDue || 0;
      
      const isAdvance = isAdvanceCreditPayment(payment);
      if (isAdvance) return;

      const paymentDate = new Date(payment.paymentDate);
      const amount = payment.paidAmount || 0;

      if (paymentDate >= currentMonthStart && paymentDate <= currentMonthEnd) {
        thisMonthSales += amount;
      }
      if (paymentDate >= lastMonthStart && paymentDate <= lastMonthEnd) {
        lastMonthSales += amount;
      }
      if (paymentDate >= currentYearStart && paymentDate <= currentYearEnd) {
        thisYearSales += amount;
      }
    });

    return { thisMonthSales, lastMonthSales, thisYearSales, totalOutstanding };
  }, [payments]);

  const syncLinkedScheduleEvents = async (payment: Payment) => {
    const linkedEvents = events.filter(event => event.paymentId === payment.id);
    await Promise.all(linkedEvents.map(event => updateEvent({
      id: event.id,
      paymentStatus: payment.status,
      paymentMethod: payment.paymentMethod,
    })));
  };

  const clearLinkedScheduleEvents = async (paymentId: string) => {
    const linkedEvents = events.filter(event => event.paymentId === paymentId);
    await Promise.all(linkedEvents.map(event => updateEvent({
      id: event.id,
      paymentId: '',
      paymentStatus: 'unpaid',
      paymentMethod: 'Unpaid',
    })));
  };

  const handleRecordPayment = async (payment: Payment, amount: number, method: PaymentMethod) => {
    // Allow negative amount to reverse payment, but not zero.
    if (amount === 0) {
        toast({ variant: 'destructive', title: "Adjustment amount cannot be zero." });
        return;
    }
    
    // Prevent over-reversing a payment
    if (payment.paidAmount + amount < 0) {
        toast({ variant: 'destructive', title: "Adjustment cannot make the paid amount negative." });
        return;
    }

    const newPaidAmount = (payment.paidAmount || 0) + amount;
    const newAmountDue = calculateAmountDue(payment.total, newPaidAmount);

    const newStatus: PaymentStatus = calculatePaymentStatus(payment.total, newPaidAmount);
    const updatedPayment = {
      ...payment,
      status: newStatus,
      paidAmount: newPaidAmount,
      amountDue: newAmountDue,
      paymentMethod: method,
      paymentDate: new Date().toISOString(),
      transactions: [
        ...(payment.transactions || []),
        createPaymentTransaction('adjustment', amount, method, amount > 0 ? 'Payment adjustment recorded.' : 'Payment reversed.'),
      ],
    };

    try {
        await updatePayment(updatedPayment);
        await syncLinkedScheduleEvents(updatedPayment);
        toast({ title: "Payment adjusted successfully." });
        setIsRecordPaymentOpen(false);
        setSelectedPayment(null);
    } catch {
        toast({ variant: 'destructive', title: "Failed to adjust payment." });
    }
  };
  
  const handleDeletePayment = async (paymentId: string) => {
    try {
        await clearLinkedScheduleEvents(paymentId);
        await deletePayment(paymentId);
        toast({ title: "Payment deleted." });
    } catch {
        toast({ variant: 'destructive', title: "Failed to delete payment." });
    }
  }

  const handleUpdatePayment = async (payment: Payment) => {
    try {
        await updatePayment(payment);
        await syncLinkedScheduleEvents(payment);
        toast({ title: "Payment updated successfully." });
    } catch {
        toast({ variant: 'destructive', title: "Failed to update payment." });
    }
  }

  const handleViewDetails = (payment: Payment) => {
    setSelectedPayment(payment);
    setIsDetailsOpen(true);
  }
  
  const handleOpenRecordPayment = (payment: Payment) => {
    setSelectedPayment(payment);
    setIsRecordPaymentOpen(true);
  };


  if (loading) {
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
            </div>
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-[520px] w-full" />
        </div>
    );
  }

  const renderAmount = (amount: number) => {
    return isTotalsHidden ? '****' : formatCurrency(amount);
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setIsTotalsHidden(!isTotalsHidden)}>
          {isTotalsHidden ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
          {isTotalsHidden ? 'Show Totals' : 'Hide Totals'}
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="rounded-lg">
          <CardContent className="p-4">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
              <CalendarCheck className="h-4 w-4" />
            </div>
            <p className="text-xs text-muted-foreground">This Month</p>
            <p className="mt-1 text-xl font-semibold">{renderAmount(paymentSummary.thisMonthSales)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-lg">
          <CardContent className="p-4">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-sky-50 text-sky-700">
              <CalendarDays className="h-4 w-4" />
            </div>
            <p className="text-xs text-muted-foreground">Last Month</p>
            <p className="mt-1 text-xl font-semibold">{renderAmount(paymentSummary.lastMonthSales)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-lg">
          <CardContent className="p-4">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-indigo-50 text-indigo-700">
              <CircleDollarSign className="h-4 w-4" />
            </div>
            <p className="text-xs text-muted-foreground">This Year</p>
            <p className="mt-1 text-xl font-semibold">{renderAmount(paymentSummary.thisYearSales)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-lg">
          <CardContent className="p-4">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-amber-50 text-amber-700">
              <WalletCards className="h-4 w-4" />
            </div>
            <p className="text-xs text-muted-foreground">Due</p>
            <p className="mt-1 text-xl font-semibold">{renderAmount(paymentSummary.totalOutstanding)}</p>
          </CardContent>
        </Card>
      </div>
      <div className="hidden lg:block">
        <RevenueReport 
          payments={payments}
          statusFilter={statusFilter}
          dateRange={dateRange}
          setDateRange={setDateRange}
        />
      </div>
      <div className="lg:hidden">
        <div className="mb-4 flex flex-col gap-2">
          <label className="text-sm font-medium">Select Date Range</label>
          <DateRangePicker dateRange={dateRange} setDateRange={setDateRange} />
        </div>
      </div>
      <PaymentsDataTable 
        payments={payments} 
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        dateRange={dateRange}
        onRecordPayment={handleOpenRecordPayment}
        onDelete={handleDeletePayment} 
        onViewDetails={handleViewDetails}
        onUpdatePayment={handleUpdatePayment}
      />
      <PaymentDetailsDialog
        isOpen={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        payment={selectedPayment}
      />
      <RecordPaymentDialog
        isOpen={isRecordPaymentOpen}
        onOpenChange={setIsRecordPaymentOpen}
        payment={selectedPayment}
        onRecordPayment={handleRecordPayment}
      />
    </div>
  );
}
