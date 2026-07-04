'use client';

import { useState } from 'react';
import { useFinance } from '@/hooks/use-finance';
import { ZakatYear, ZakatPayment } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface PaymentsTableProps {
  activeYear: ZakatYear;
}

export function PaymentsTable({ activeYear }: PaymentsTableProps) {
  const { payments, addPayment, updatePayment, deletePayment } = useFinance();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [recipientName, setRecipientName] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('CAD');
  const [exchangeRate, setExchangeRate] = useState('1');
  const [date, setDate] = useState('');
  const [method, setMethod] = useState<'Cash'|'Bank Transfer'|'E-transfer'|'Other'>('Bank Transfer');
  const [notes, setNotes] = useState('');

  const yearPayments = payments?.filter(p => p.yearId === activeYear.id) || [];

  const handleOpen = (payment?: ZakatPayment) => {
    if (payment) {
      setEditingId(payment.id);
      setRecipientName(payment.recipientName);
      setAmount(payment.amount.toString());
      setCurrency(payment.currency);
      setExchangeRate(payment.exchangeRate.toString());
      setDate(payment.date);
      setMethod(payment.method);
      setNotes(payment.notes || '');
    } else {
      setEditingId(null);
      setRecipientName('');
      setAmount('');
      setCurrency('CAD');
      setExchangeRate('1');
      setDate(new Date().toISOString().split('T')[0]);
      setMethod('Bank Transfer');
      setNotes('');
    }
    setIsOpen(true);
  };

  const handleCurrencyChange = (val: string) => {
    setCurrency(val);
    if (val === 'INR') setExchangeRate((1 / activeYear.exchangeRateINR).toFixed(4));
    else if (val === 'CAD') setExchangeRate('1');
  };

  const handleSave = async () => {
    const val = Number(amount);
    const rate = Number(exchangeRate);
    const valueInCAD = val * rate;

    const data = {
      yearId: activeYear.id,
      recipientName, amount: val, currency, 
      exchangeRate: rate,
      valueInCAD,
      date,
      method,
      notes
    };

    if (editingId) {
      await updatePayment({ id: editingId, ...data });
    } else {
      await addPayment(data);
    }
    setIsOpen(false);
  };

  const formatMoney = (val: number) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(val);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => handleOpen()}><Plus className="w-4 h-4 mr-2"/> Log Zakat Payment</Button>
      </div>

      <div className="border rounded-lg bg-white overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead>Method</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Value (CAD)</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {yearPayments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No Zakat payments recorded yet.</TableCell>
              </TableRow>
            ) : (
              yearPayments.map(p => (
                <TableRow key={p.id}>
                  <TableCell>{p.date}</TableCell>
                  <TableCell className="font-medium">{p.recipientName}</TableCell>
                  <TableCell>{p.method}</TableCell>
                  <TableCell className="text-right">{p.amount.toLocaleString()} {p.currency}</TableCell>
                  <TableCell className="text-right font-medium text-emerald-700">{formatMoney(p.valueInCAD)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleOpen(p)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-red-500" onClick={() => deletePayment(p.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? 'Edit' : 'Add'} Zakat Payment</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Recipient Name</Label>
              <Input value={recipientName} onChange={e => setRecipientName(e.target.value)} placeholder="Local Mosque" />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Method</Label>
              <Select value={method} onValueChange={(v: any) => setMethod(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                  <SelectItem value="E-transfer">E-transfer</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={handleCurrencyChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CAD">CAD</SelectItem>
                  <SelectItem value="INR">INR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Exchange Rate (to CAD)</Label>
              <Input type="number" step="0.0001" value={exchangeRate} onChange={e => setExchangeRate(e.target.value)} />
            </div>

            <div className="col-span-2 space-y-2">
              <Label>Notes</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
