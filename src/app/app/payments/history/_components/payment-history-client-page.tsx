'use client';

import { usePayments } from '@/hooks/use-payments';
import { useEvents } from '@/hooks/use-events';
import { Payment, PaymentMethod, PaymentStatus } from '@/lib/types';
import { RevenueReport } from './revenue-report';
import { PaymentsDataTable } from './payments-data-table';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PaymentDetailsDialog } from './payment-details-dialog';
import { RecordPaymentDialog } from './record-payment-dialog';
import { DateRangePicker } from './date-range-picker';
import { formatCurrency } from '@/lib/utils';
import { AlertTriangle, ArrowRight, CircleDollarSign, CreditCard, Eye, EyeOff, FileText, TrendingUp, WalletCards } from 'lucide-react';
import { calculateAmountDue, calculatePaymentStatus, createPaymentTransaction, getCollectedAmount, getOutstandingAmount, isAdvanceCreditPayment } from '@/lib/payment-utils';
import { Button } from '@/components/ui/button';
import { endOfDay, startOfDay, startOfMonth, endOfMonth } from 'date-fns';
import { DateRange } from 'react-day-picker';

export function PaymentHistoryClientPage() {
  const { payments, loading, updatePayment, deletePayment } = usePayments();
  const { events, updateEvent } = useEvents();
  const { toast } = useToast();
  const router = useRouter();
  
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
  const paymentsTableRef = useRef<HTMLDivElement>(null);

  const paymentSummary = useMemo(() => {
    const safePayments = payments || [];
    const from = dateRange?.from ? startOfDay(dateRange.from) : null;
    const to = dateRange?.to ? endOfDay(dateRange.to) : from ? endOfDay(from) : null;
    const inSelectedRange = (payment: Payment) => {
      if (!from || !to) return true;
      const date = new Date(payment.paymentDate);
      return !Number.isNaN(date.getTime()) && date >= from && date <= to;
    };
    const selectedPayments = safePayments.filter(inSelectedRange);
    const billPayments = selectedPayments.filter(payment => !isAdvanceCreditPayment(payment));
    const collected = billPayments.reduce((sum, payment) => sum + getCollectedAmount(payment), 0);
    const cost = billPayments.reduce((sum, payment) => sum + (Number.isFinite(payment.totalCost) ? payment.totalCost : 0), 0);
    const outstanding = safePayments.reduce((sum, payment) => sum + getOutstandingAmount(payment), 0);
    const duePayments = safePayments.filter(payment => getOutstandingAmount(payment) > 0.009);
    const partialPayments = duePayments.filter(payment => getCollectedAmount(payment) > 0.009);
    const methodAmounts: Record<'Cash' | 'E-Transfer' | 'Other' | 'Advance', number> = {
      Cash: 0,
      'E-Transfer': 0,
      Other: 0,
      Advance: 0,
    };

    selectedPayments.forEach(payment => {
      if (isAdvanceCreditPayment(payment)) {
        methodAmounts.Advance += Math.max(0, Number(payment.paidAmount) || 0);
        return;
      }

      const transactions = (payment.transactions || []).filter(transaction =>
        transaction.type === 'payment' || transaction.type === 'adjustment'
      );
      if (transactions.length > 0) {
        transactions.forEach(transaction => {
          if (transaction.method in methodAmounts) {
            methodAmounts[transaction.method as keyof typeof methodAmounts] += Number(transaction.amount) || 0;
          }
        });
      } else if (payment.paymentMethod in methodAmounts) {
        methodAmounts[payment.paymentMethod as keyof typeof methodAmounts] += getCollectedAmount(payment);
      }
    });

    return {
      collected,
      cost,
      outstanding,
      billCount: billPayments.length,
      dueCount: duePayments.length,
      partialCount: partialPayments.length,
      netAfterCost: collected - cost,
      methodAmounts: Object.fromEntries(
        Object.entries(methodAmounts).map(([method, amount]) => [method, Math.max(0, amount)])
      ) as typeof methodAmounts,
    };
  }, [payments, dateRange]);

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

  const handleViewUnpaidBills = () => {
    setStatusFilter('unpaid');
    window.setTimeout(() => {
      paymentsTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
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
      <div className="rounded-xl border bg-muted/20 p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Financial snapshot</p>
            <p className="text-xs text-muted-foreground">Choose a period to update the profit figures.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setIsTotalsHidden(!isTotalsHidden)}>
            {isTotalsHidden ? <Eye className="h-4 w-4 sm:mr-2" /> : <EyeOff className="h-4 w-4 sm:mr-2" />}
            <span className="hidden sm:inline">{isTotalsHidden ? 'Show Totals' : 'Hide Totals'}</span>
          </Button>
        </div>
        <div className="mt-3 w-full">
          <DateRangePicker dateRange={dateRange} setDateRange={setDateRange} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="rounded-lg">
          <CardContent className="p-4">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
              <TrendingUp className="h-4 w-4" />
            </div>
            <p className="text-xs text-muted-foreground">Net profit</p>
            <p className="mt-1 text-xl font-semibold">{renderAmount(paymentSummary.netAfterCost)}</p>
            <p className="mt-1 text-xs text-muted-foreground">After recorded bill costs</p>
          </CardContent>
        </Card>
        <Card className="rounded-lg">
          <CardContent className="p-4">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-sky-50 text-sky-700">
              <WalletCards className="h-4 w-4" />
            </div>
            <p className="text-xs text-muted-foreground">Outstanding</p>
            <p className="mt-1 text-xl font-semibold">{renderAmount(paymentSummary.outstanding)}</p>
            <p className="mt-1 text-xs text-muted-foreground">All unpaid balances</p>
          </CardContent>
        </Card>
        <Card className="rounded-lg">
          <CardContent className="p-4">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-indigo-50 text-indigo-700">
              <FileText className="h-4 w-4" />
            </div>
            <p className="text-xs text-muted-foreground">Bills issued</p>
            <p className="mt-1 text-xl font-semibold">{paymentSummary.billCount}</p>
            <p className="mt-1 text-xs text-muted-foreground">Selected period</p>
          </CardContent>
        </Card>
        <Card className="rounded-lg">
          <CardContent className="p-4">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-amber-50 text-amber-700">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <p className="text-xs text-muted-foreground">Need payment</p>
            <p className="mt-1 text-xl font-semibold">{paymentSummary.dueCount}</p>
            <p className="mt-1 text-xs text-muted-foreground">Bills with balance</p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="rounded-lg">
          <CardContent className="p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">Attention needed</h2>
                <p className="text-sm text-muted-foreground">The items most likely to need your next action.</p>
              </div>
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div className="space-y-2">
              <button type="button" onClick={handleViewUnpaidBills} className="flex w-full items-center justify-between rounded-lg border bg-background p-3 text-left transition-colors hover:bg-muted/40">
                <span className="text-sm">Bills with a remaining balance</span>
                <span className="flex items-center gap-2 text-sm font-semibold">{paymentSummary.dueCount}<ArrowRight className="h-4 w-4" /></span>
              </button>
              <button type="button" onClick={handleViewUnpaidBills} className="flex w-full items-center justify-between rounded-lg border bg-background p-3 text-left transition-colors hover:bg-muted/40">
                <span className="text-sm">Partially paid bills</span>
                <span className="flex items-center gap-2 text-sm font-semibold">{paymentSummary.partialCount}<ArrowRight className="h-4 w-4" /></span>
              </button>
              <div className="flex items-center justify-between rounded-lg border bg-background p-3">
                <span className="text-sm">Advance credit recorded</span>
                <span className="text-sm font-semibold">{renderAmount(paymentSummary.methodAmounts.Advance)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-lg">
          <CardContent className="p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">Profit breakdown</h2>
                <p className="text-sm text-muted-foreground">How the selected period contributes to profit.</p>
              </div>
              <CircleDollarSign className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border bg-background p-3 text-sm">
                <span>Recorded costs</span>
                <span className="font-semibold">{renderAmount(paymentSummary.cost)}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border bg-emerald-50 p-3 text-sm text-emerald-900">
                <span>Net profit</span>
                <span className="font-semibold">{renderAmount(paymentSummary.netAfterCost)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => router.push('/app/payments')}>
          <CreditCard className="mr-2 h-4 w-4" /> Open POS
        </Button>
        <Button variant="outline" size="sm" onClick={handleViewUnpaidBills}>
          <WalletCards className="mr-2 h-4 w-4" /> View unpaid bills
        </Button>
      </div>
      <div>
        <RevenueReport 
          payments={payments}
          statusFilter={statusFilter}
          dateRange={dateRange}
        />
      </div>
      <div ref={paymentsTableRef} className="scroll-mt-4">
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
      </div>
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
