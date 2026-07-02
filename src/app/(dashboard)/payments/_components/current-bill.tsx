'use client';

import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { BillItem, PaymentMethod, Payment, Student, PaymentStatus } from '@/lib/types';
import { Calendar as CalendarIcon, X, PlusCircle, Minus, Plus, ReceiptText, WalletCards } from 'lucide-react';
import { format, setHours, setMinutes, isValid } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { cn, formatCurrency } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { usePayments } from '@/hooks/use-payments';
import { useSmsLogs } from '@/hooks/use-sms-logs';
import { useRouter } from 'next/navigation';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { calculateAmountDue, calculatePaymentStatus, createPaymentTransaction, getStudentAdvanceCredit } from '@/lib/payment-utils';
import { MissingPhoneDialog } from '@/app/(dashboard)/_components/missing-phone-dialog';

interface CurrentBillProps {
  billItems: BillItem[];
  activeBill: Payment | null;
  selectedStudent: Student | null;
  onReset: () => void;
  onRemoveItem: (billItemId: string) => void;
  onItemDateTimeChange: (billItemId: string, newDate: Date) => void;
  onItemPriceChange: (billItemId: string, newPrice: number) => void;
  onItemQuantityChange: (billItemId: string, newQuantity: number) => void;
  isEditing: boolean;
}

function toDateTimeLocalValue(dateString: string) {
  const date = new Date(dateString);
  return format(isValid(date) ? date : new Date(), "yyyy-MM-dd'T'HH:mm");
}

export function CurrentBill({
  billItems,
  activeBill,
  selectedStudent,
  onReset,
  onRemoveItem,
  onItemDateTimeChange,
  onItemPriceChange,
  onItemQuantityChange,
  isEditing,
}: CurrentBillProps) {
  const { payments, addPayment, updatePayment } = usePayments();
  const { sendAndLogSms } = useSmsLogs();
  const { toast } = useToast();
  const router = useRouter();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Unpaid');
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState(0);
  const [amountPaidNow, setAmountPaidNow] = useState(0);
  const [applyTax, setApplyTax] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [sendSms, setSendSms] = useState(false);
  const [missingPhoneStudent, setMissingPhoneStudent] = useState<Student | null>(null);
  const [paymentDateIso, setPaymentDateIso] = useState(new Date().toISOString());

  useEffect(() => {
    if (activeBill) {
        setPaymentMethod(activeBill.paymentMethod);
        setNotes(activeBill.notes || '');
        setDiscount(activeBill.discount || 0);
        setApplyTax(activeBill.tax > 0);
        setIsNotesOpen(!!activeBill.notes);
        setPaymentDateIso(activeBill.paymentDate || new Date().toISOString());
    } else {
        setPaymentMethod('Unpaid');
        setNotes('');
        setDiscount(0);
        setApplyTax(false);
        setIsNotesOpen(false);
        setPaymentDateIso(new Date().toISOString());
    }
    setAmountPaidNow(0);
  }, [activeBill]);

  const subtotal = useMemo(() => billItems.reduce((sum, item) => sum + (item.price * item.quantity), 0), [billItems]);
  const totalCost = useMemo(() => billItems.reduce((sum, item) => sum + ((item.cost || 0) * item.quantity), 0), [billItems]);
  const taxAmount = useMemo(() => applyTax ? (subtotal - discount) * 0.13 : 0, [applyTax, subtotal, discount]);
  const total = useMemo(() => subtotal - discount + taxAmount, [subtotal, discount, taxAmount]);
  const isFinalizing = paymentMethod !== 'Unpaid';
  const isAdvancePayment = paymentMethod === 'Advance';
  const isCreatingAdvanceCredit = isAdvancePayment && billItems.length === 0;
  const availableCredit = useMemo(() => {
    const credit = getStudentAdvanceCredit(payments, selectedStudent?.id, activeBill?.id);
    return credit + (activeBill?.creditApplied || 0);
  }, [payments, selectedStudent?.id, activeBill?.id, activeBill?.creditApplied]);

  useEffect(() => {
    if (isFinalizing && !isAdvancePayment) {
        const amountDue = activeBill ? activeBill.amountDue : total;
        setAmountPaidNow(Math.max(0, amountDue - availableCredit));
    } else if (isAdvancePayment && billItems.length > 0) {
        setAmountPaidNow(0);
    } else if (!isFinalizing) {
        setAmountPaidNow(0);
    }
  }, [isFinalizing, isAdvancePayment, billItems.length, total, activeBill, availableCredit]);

  const handleFinalize = async () => {
    if (isAdvancePayment && !selectedStudent && !activeBill) {
      toast({ variant: 'destructive', title: 'Please select a student for advance payment.' });
      return;
    }

    const estimatedCreditApplied = selectedStudent && !isCreatingAdvanceCredit ? Math.min(availableCredit, total) : 0;

    if (isAdvancePayment && billItems.length > 0 && estimatedCreditApplied <= 0) {
      toast({ variant: 'destructive', title: 'No advance credit available for this student.' });
      return;
    }

    if (isFinalizing && amountPaidNow <= 0 && estimatedCreditApplied <= 0) {
      toast({ variant: 'destructive', title: 'Payment amount must be greater than zero.' });
      return;
    }

    const advanceOnly = isCreatingAdvanceCredit;
    const finalBillItems = advanceOnly
      ? [{
          id: 'advance-payment',
          billItemId: `advance-${Date.now()}`,
          name: 'Advance Payment',
          price: amountPaidNow,
          cost: 0,
          date: paymentDateIso,
          quantity: 1,
        }]
      : billItems;
    const finalSubtotal = advanceOnly ? amountPaidNow : subtotal;
    const finalTax = advanceOnly ? 0 : taxAmount;
    const finalDiscount = advanceOnly ? 0 : discount;
    const finalTotal = advanceOnly ? amountPaidNow : total;
    const finalTotalCost = advanceOnly ? 0 : totalCost;
    const creditApplied = !advanceOnly && selectedStudent ? Math.min(availableCredit, finalTotal) : 0;
    const existingPaidAmount = activeBill?.paidAmount || 0;
    const previousCreditApplied = activeBill?.creditApplied || 0;
    const existingCashPaidAmount = Math.max(0, existingPaidAmount - previousCreditApplied);
    const newPaidAmount = existingCashPaidAmount + amountPaidNow + creditApplied;
    const newAmountDue = calculateAmountDue(finalTotal, newPaidAmount);

    const newStatus: PaymentStatus = calculatePaymentStatus(finalTotal, newPaidAmount);
    const finalPaymentMethod: PaymentMethod = advanceOnly || (!advanceOnly && amountPaidNow <= 0 && creditApplied > 0) ? 'Advance' : paymentMethod;
    const transactions = [
      ...(activeBill?.transactions || []),
      ...(advanceOnly
        ? [createPaymentTransaction('credit-created', amountPaidNow, 'Advance', 'Advance payment credit created.', paymentDateIso)]
        : []),
      ...(!advanceOnly && creditApplied > 0
        ? [createPaymentTransaction('credit-applied', creditApplied, 'Advance', 'Student advance credit applied to this bill.', paymentDateIso)]
        : []),
      ...(amountPaidNow > 0 && !advanceOnly
        ? [createPaymentTransaction('payment', amountPaidNow, paymentMethod, 'Payment recorded.', paymentDateIso)]
        : []),
    ];

    const paymentData = {
      studentId: selectedStudent?.id ?? null,
      studentName: selectedStudent?.name ?? 'Walk-in Customer',
      items: finalBillItems,
      subtotal: finalSubtotal,
      discount: finalDiscount,
      tax: finalTax,
      total: finalTotal,
      totalCost: finalTotalCost || 0,
      paidAmount: newPaidAmount,
      amountDue: newAmountDue,
      paymentMethod: finalPaymentMethod,
      paymentDate: paymentDateIso,
      status: newStatus,
      notes,
      creditApplied,
      transactions,
    };

    try {
        if (activeBill) {
            await updatePayment({ ...paymentData, id: activeBill.id });
            toast({ title: 'Payment updated successfully!' });
        } else {
            await addPayment(paymentData);
            toast({ title: 'Payment recorded successfully!' });
        }

        const servicesDesc = advanceOnly ? 'Advance Payment' : finalBillItems.map(item => item.name).join(', ');

        const proceedWithCompletion = () => {
          onReset();
          router.push('/payments/history');
        };

        if (sendSms && selectedStudent && amountPaidNow > 0) {
          if (!selectedStudent.mobileNumber?.trim()) {
            setMissingPhoneStudent(selectedStudent);
            // We will pause and wait for the dialog to finish. We can't await it easily here without a promise wrapper,
            // but the MissingPhoneDialog will handle sending the SMS and then we can navigate.
            // Wait, if it pops up, `handleFinalize` finishes and user is still on the page. We shouldn't route away immediately!
            return;
          } else {
            await sendPaymentSms(selectedStudent.mobileNumber, amountPaidNow, servicesDesc, selectedStudent.name);
          }
        }

        proceedWithCompletion();
    } catch (e) {
        toast({ variant: 'destructive', title: 'Error processing payment' });
    }
  };

  const sendPaymentSms = async (mobileNumber: string, amount: number, servicesDesc: string, studentName: string) => {
    const body = `SparkOn: Received payment of $${amount} for ${servicesDesc}. Thank you!\n\nFollow for more tricks and tips: instagram.com/SparkOnDrive`;
    const result = await sendAndLogSms(mobileNumber, body, {
      templateKey: 'payment',
      variables: {
        1: studentName,
        2: amount.toFixed(2),
        3: servicesDesc,
      },
    });

    if (!result.ok) {
      toast({
        variant: 'destructive',
        title: 'Message not sent',
        description: result.error || 'Could not send the payment text.',
      });
    } else {
      toast({
        title: result.channel === 'whatsapp' ? 'WhatsApp message sent' : 'SMS message sent',
        description: result.fallbackFrom === 'whatsapp'
          ? `WhatsApp was not available, so SMS receipt was sent to ${studentName}.`
          : `Payment receipt sent to ${studentName}.`,
      });
    }
  };

  const handleUpdateBill = async () => {
    if (!activeBill && !selectedStudent) {
      toast({ variant: 'destructive', title: 'Please select a student' });
      return;
    }

    const paidAmount = activeBill?.paidAmount || 0;
    const amountDue = calculateAmountDue(total, paidAmount);

    const status: PaymentStatus = calculatePaymentStatus(total, paidAmount);

    const billData: Omit<Payment, 'id'> = {
      studentId: selectedStudent?.id || null,
      studentName: selectedStudent?.name || 'Walk-in Customer',
      items: billItems,
      subtotal,
      discount,
      tax: taxAmount,
      total,
      totalCost: totalCost || 0,
      paidAmount,
      amountDue,
      paymentMethod: 'Unpaid',
      paymentDate: paymentDateIso,
      status,
      notes,
      creditApplied: activeBill?.creditApplied || 0,
      transactions: activeBill?.transactions || [],
    };

    try {
      if (activeBill) {
        await updatePayment({ ...billData, id: activeBill.id });
      } else {
        await addPayment(billData);
      }
      toast({ title: "Student's bill has been updated." });
      onReset();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Failed to update bill' });
    }
  }

  const handleTimeChange = (billItemId: string, timeValue: string) => {
    const [hours, minutes] = timeValue.split(':').map(Number);
    const currentItem = billItems.find(item => item.billItemId === billItemId);
    if (currentItem) {
      const current_date = new Date(currentItem.date);
      const newDate = setMinutes(setHours(current_date, hours), minutes);
      onItemDateTimeChange(billItemId, newDate);
    }
  }

  const customerName = selectedStudent?.name || activeBill?.studentName || 'Walk-in Customer';

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border bg-card shadow-sm">
      <CardHeader className="shrink-0 border-b bg-[#111827] px-4 py-4 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
              {isEditing ? 'Edit Payment' : 'Current Bill'}
            </p>
            <CardTitle className="truncate text-xl">{customerName}</CardTitle>
            <p className="mt-1 text-sm text-white/65">
              {billItems.length} {billItems.length === 1 ? 'item' : 'items'} ready
            </p>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10">
            <ReceiptText className="h-6 w-6" />
          </div>
        </div>
        <div className="mt-4 flex items-end justify-between rounded-2xl bg-white/10 px-3 py-2">
          <span className="text-xs text-white/60">Bill Total</span>
          <span className="text-2xl font-bold">{formatCurrency(total)}</span>
        </div>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden pt-0">
        <div className="min-h-[150px] flex-1 overflow-hidden">
          <ScrollArea className="h-full pr-4 -mr-4">
              <div className="space-y-4 pt-4">
                  {billItems.length === 0 ? (
                      <div className="rounded-2xl border border-dashed bg-muted/30 px-4 py-10 text-center text-muted-foreground">
                          <WalletCards className="mx-auto mb-3 h-8 w-8 opacity-60" />
                          <p className="font-medium text-foreground">No services added yet</p>
                          <p className="mt-1 text-sm">Tap a service to start this bill.</p>
                      </div>
                  ) : billItems.map(item => {
                    const itemDate = new Date(item.date);
                    const displayDate = isValid(itemDate) ? itemDate : new Date();
                    return (
                      <div key={item.billItemId} className="flex items-start gap-3 rounded-2xl border bg-background p-3 shadow-sm">
                          <div className="flex-1 space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-semibold leading-tight">{item.name}</p>
                                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">
                                  {formatCurrency(item.price * item.quantity)}
                                </span>
                              </div>
                              <div className='flex items-center justify-between mt-1'>
                                  <div className="flex items-center gap-1">
                                    <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => onItemQuantityChange(item.billItemId, item.quantity - 1)}>
                                        <Minus className="h-4 w-4" />
                                    </Button>
                                    <Input
                                        type="number"
                                        value={item.quantity}
                                        onChange={(e) => onItemQuantityChange(item.billItemId, parseInt(e.target.value) || 0)}
                                        className="h-8 w-12 rounded-lg text-center text-sm"
                                    />
                                    <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => onItemQuantityChange(item.billItemId, item.quantity + 1)}>
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                  </div>
                                <Input
                                    type="number"
                                    value={item.price}
                                    onChange={(e) => onItemPriceChange(item.billItemId, parseFloat(e.target.value) || 0)}
                                    className="h-8 w-24 rounded-lg text-right text-sm"
                                    step="0.01"
                                />
                              </div>
                               <Popover>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant={"outline"}
                                      size="sm"
                                      className={cn("h-9 w-full justify-start rounded-lg text-left text-sm font-normal", !item.date && "text-muted-foreground")}
                                    >
                                      <CalendarIcon className="mr-2 h-4 w-4" />
                                      {item.date ? format(displayDate, "MMM d, h:mm a") : <span>Pick date</span>}
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0 z-50">
                                    <Calendar
                                      mode="single"
                                      selected={displayDate}
                                      onSelect={(date) => date && onItemDateTimeChange(item.billItemId, date)}
                                      initialFocus
                                    />
                                    <div className="p-2 border-t">
                                        <Label className="text-xs">Time</Label>
                                        <Input
                                            type="time"
                                            defaultValue={format(displayDate, 'HH:mm')}
                                            onChange={(e) => handleTimeChange(item.billItemId, e.target.value)}
                                            step="900" // 15-minute increments
                                            className="h-8"
                                        />
                                    </div>
                                  </PopoverContent>
                                </Popover>
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0 rounded-full hover:bg-destructive/10" onClick={() => onRemoveItem(item.billItemId)}>
                              <X className="h-4 w-4 text-destructive/80" />
                          </Button>
                      </div>
                    )
                  })}
              </div>
          </ScrollArea>
        </div>
      </CardContent>

      <CardFooter className="max-h-[46vh] shrink-0 flex-col !items-stretch space-y-4 overflow-y-auto border-t bg-muted/25 px-4 py-4 sm:max-h-none sm:overflow-visible sm:px-5">

        <Collapsible open={isNotesOpen} onOpenChange={setIsNotesOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="link" className="h-auto p-0 text-sm text-muted-foreground">
                <PlusCircle className="mr-2 h-4 w-4" />
                {isNotesOpen ? 'Close Notes' : 'Add Notes'}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
             <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes for this transaction..."
                className="mt-2 bg-card"
            />
          </CollapsibleContent>
        </Collapsible>

            <div className="space-y-2">
            <Label htmlFor="paymentDate">Bill / Payment Date</Label>
            <Input
              id="paymentDate"
              type="datetime-local"
              value={toDateTimeLocalValue(paymentDateIso)}
              onChange={(event) => {
                const nextDate = event.target.value ? new Date(event.target.value) : new Date();
                setPaymentDateIso(nextDate.toISOString());
              }}
              className="h-10 rounded-xl bg-card"
            />
          </div>

            <div className="space-y-2">
            <Label>Payment Method</Label>
            <Select value={paymentMethod} onValueChange={value => setPaymentMethod(value as PaymentMethod)}>
              <SelectTrigger className="rounded-xl bg-card"><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="Unpaid">Unpaid / Update Bill</SelectItem>
                <SelectItem value="Cash">Cash</SelectItem>
                <SelectItem value="E-Transfer">E-Transfer</SelectItem>
                <SelectItem value="Advance">Advance Payment</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

        {isFinalizing && !(isAdvancePayment && billItems.length > 0) && (
            <div className="space-y-2">
                <Label htmlFor='amountPaid'>{isCreatingAdvanceCredit ? 'Advance Amount' : 'Amount Paid'}</Label>
                <Input
                    id="amountPaid"
                    type="number"
                    value={amountPaidNow}
                    onChange={(e) => setAmountPaidNow(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="h-9 rounded-xl bg-card text-right"
                />
            </div>
        )}

        {selectedStudent && availableCredit > 0 && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                Available advance credit: <span className="font-semibold">{formatCurrency(availableCredit)}</span>
            </div>
        )}

        {isFinalizing && selectedStudent && amountPaidNow > 0 && (
          <div className="flex items-center space-x-2 rounded-lg border bg-background px-3 py-3 shadow-sm">
            <Checkbox id="sendSms" checked={sendSms} onCheckedChange={(checked) => setSendSms(checked as boolean)} />
            <label htmlFor="sendSms" className="text-sm font-medium leading-none cursor-pointer">
              Send SMS Receipt
            </label>
          </div>
        )}

        <Separator />

        <div className="space-y-2 rounded-2xl bg-card p-3">
          <div className="flex justify-between items-center text-sm">
            <span>Subtotal:</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>

          <div className="flex justify-between items-center text-sm">
            <Label htmlFor='discount' className="flex-1">Discount:</Label>
            <div className="w-28">
              <Input
                id="discount"
                type="number"
                value={discount}
                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="h-8 rounded-lg bg-background text-right"
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
              <Checkbox id="tax" checked={applyTax} onCheckedChange={(checked) => setApplyTax(checked as boolean)} />
              <label
                  htmlFor="tax"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex-1"
              >
                  Apply Tax (13%)
              </label>
              <span className={cn("text-sm", !applyTax && "text-muted-foreground")}>{formatCurrency(taxAmount)}</span>
          </div>
        </div>

        <Separator />

        <div className="flex items-center justify-between rounded-2xl bg-[#111827] px-4 py-3 text-white">
          <span>Total:</span>
          <span>{formatCurrency(total)}</span>
        </div>

        {selectedStudent && availableCredit > 0 && total > 0 && (
          <div className="flex justify-between items-center text-sm text-emerald-700">
            <span>Credit to apply:</span>
            <span className="font-semibold">-{formatCurrency(Math.min(availableCredit, total))}</span>
          </div>
        )}

        {activeBill && (
             <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Already Paid:</span>
                    <span className="font-medium">{formatCurrency(activeBill.paidAmount)}</span>
                </div>
                <div className="flex justify-between items-center font-semibold">
                    <span className="text-muted-foreground">Amount Due:</span>
                    <span className={cn(activeBill.amountDue <= 0 ? 'text-green-600' : 'text-destructive')}>{formatCurrency(activeBill.amountDue)}</span>
                </div>
            </div>
        )}

        <div className="grid grid-cols-2 gap-2">
            <Button size="lg" variant="outline" className="rounded-xl" onClick={onReset}>
                Clear
            </Button>
            {isFinalizing ? (
                <Button size="lg" className="rounded-xl" onClick={handleFinalize} disabled={billItems.length === 0 && !isAdvancePayment}>
                    Record Payment
                </Button>
            ) : (
                <Button size="lg" className="rounded-xl" onClick={handleUpdateBill} disabled={billItems.length === 0}>
                    {activeBill ? 'Update Bill' : 'Save Bill'}
                </Button>
            )}
        </div>
      </CardFooter>

      <MissingPhoneDialog
        isOpen={!!missingPhoneStudent}
        student={missingPhoneStudent}
        onCancel={() => {
          setMissingPhoneStudent(null);
          // Navigate since they opted to skip SMS
          onReset();
          router.push('/payments/history');
        }}
        onSuccess={async (updatedStudent) => {
          setMissingPhoneStudent(null);
          // Send SMS now that we have the number
          const advanceOnly = isAdvancePayment && billItems.length === 0;
          const servicesDesc = advanceOnly ? 'Advance Payment' : billItems.map(item => item.name).join(', ');
          await sendPaymentSms(updatedStudent.mobileNumber, amountPaidNow, servicesDesc, updatedStudent.name);
          onReset();
          router.push('/payments/history');
        }}
      />
    </Card>
  );
}
