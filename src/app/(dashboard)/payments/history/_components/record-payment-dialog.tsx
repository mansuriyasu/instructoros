'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Payment, PaymentMethod } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';

interface RecordPaymentDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  payment: Payment | null;
  onRecordPayment: (payment: Payment, amount: number, method: PaymentMethod) => void;
}

export function RecordPaymentDialog({
  isOpen,
  onOpenChange,
  payment,
  onRecordPayment,
}: RecordPaymentDialogProps) {
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>('Cash');

  useEffect(() => {
    if (payment) {
      // Default amount to the total amount due
      setAmount(payment.amountDue);
      // Default to Cash or the last used method if not 'Unpaid'
      setMethod(payment.paymentMethod !== 'Unpaid' ? payment.paymentMethod : 'Cash');
    }
  }, [payment, isOpen]);

  if (!payment) return null;

  const handleRecord = () => {
    // A check for exactly 0 is fine, but we allow negative values to reverse payments.
    if (amount === 0) {
      onOpenChange(false);
      return;
    }
    onRecordPayment(payment, amount, method);
  };
  
  const handleSetFullAmount = () => {
    setAmount(payment.amountDue);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust Payment</DialogTitle>
          <DialogDescription>
            For {payment.studentName} - Bill Total: {formatCurrency(payment.total)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <div className="flex justify-between items-baseline">
                <Label htmlFor="amount">Amount Due</Label>
                <Button variant="link" size="sm" className="p-0 h-auto" onClick={handleSetFullAmount}>Pay Full Amount</Button>
            </div>
            <p className="text-2xl font-bold text-destructive">{formatCurrency(payment.amountDue)}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount-paid">Amount to Adjust</Label>
            <Input
              id="amount-paid"
              type="number"
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              step="0.01"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment-method">Payment Method</Label>
            <Select value={method} onValueChange={(value) => setMethod(value as PaymentMethod)}>
              <SelectTrigger id="payment-method">
                <SelectValue placeholder="Select a method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Cash">Cash</SelectItem>
                <SelectItem value="E-Transfer">E-Transfer</SelectItem>
                <SelectItem value="Advance">Advance Credit</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
           <Alert variant="default" className="mt-4">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                    To reverse a payment, enter a negative amount. For example, to undo a $50 payment, enter -50.
                </AlertDescription>
            </Alert>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleRecord}>
            Record Adjustment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
