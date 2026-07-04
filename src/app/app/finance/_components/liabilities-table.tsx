'use client';

import { useState } from 'react';
import { useFinance } from '@/hooks/use-finance';
import { ZakatYear, FinanceLiability } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

interface LiabilitiesTableProps {
  activeYear: ZakatYear;
}

export function LiabilitiesTable({ activeYear }: LiabilitiesTableProps) {
  const { liabilities, addLiability, updateLiability, deleteLiability } = useFinance();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [personCompany, setPersonCompany] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('CAD');
  const [exchangeRate, setExchangeRate] = useState('1');
  const [dueDate, setDueDate] = useState('');
  const [deductible, setDeductible] = useState(true);
  const [notes, setNotes] = useState('');

  const yearLiabilities = liabilities?.filter(l => l.yearId === activeYear.id) || [];

  const handleOpen = (liability?: FinanceLiability) => {
    if (liability) {
      setEditingId(liability.id);
      setName(liability.name);
      setPersonCompany(liability.personCompany);
      setAmount(liability.amount.toString());
      setCurrency(liability.currency);
      setExchangeRate(liability.exchangeRate.toString());
      setDueDate(liability.dueDate);
      setDeductible(liability.deductible);
      setNotes(liability.notes || '');
    } else {
      setEditingId(null);
      setName('');
      setPersonCompany('');
      setAmount('');
      setCurrency('CAD');
      setExchangeRate('1');
      setDueDate('');
      setDeductible(true);
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
      name, personCompany, amount: val, currency, 
      exchangeRate: rate,
      valueInCAD,
      dueDate,
      deductible,
      notes
    };

    if (editingId) {
      await updateLiability({ id: editingId, ...data });
    } else {
      await addLiability(data);
    }
    setIsOpen(false);
  };

  const formatMoney = (val: number) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(val);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => handleOpen()}><Plus className="w-4 h-4 mr-2"/> Add Liability</Button>
      </div>

      <div className="border rounded-lg bg-white overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Liability Name</TableHead>
              <TableHead>Person / Company</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Original Amount</TableHead>
              <TableHead className="text-right">Value (CAD)</TableHead>
              <TableHead className="text-center">Zakat Deductible?</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {yearLiabilities.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No liabilities added.</TableCell>
              </TableRow>
            ) : (
              yearLiabilities.map(l => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.name}</TableCell>
                  <TableCell>{l.personCompany}</TableCell>
                  <TableCell>{l.dueDate}</TableCell>
                  <TableCell className="text-right">{l.amount.toLocaleString()} {l.currency}</TableCell>
                  <TableCell className="text-right font-medium">{formatMoney(l.valueInCAD)}</TableCell>
                  <TableCell className="text-center">
                    {l.deductible ? <span className="bg-emerald-100 text-emerald-800 px-2 py-1 rounded text-xs">Yes</span> : <span className="bg-slate-100 text-slate-800 px-2 py-1 rounded text-xs">No</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleOpen(l)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-red-500" onClick={() => deleteLiability(l.id)}><Trash2 className="w-4 h-4" /></Button>
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
          <DialogHeader><DialogTitle>{editingId ? 'Edit' : 'Add'} Liability</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Liability Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Credit Card Bill" />
            </div>
            <div className="space-y-2">
              <Label>Person / Company</Label>
              <Input value={personCompany} onChange={e => setPersonCompany(e.target.value)} placeholder="Scotiabank" />
            </div>
            
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
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

            <div className="col-span-2 flex items-center space-x-3 bg-muted/50 p-3 rounded-lg border mt-2">
              <Switch checked={deductible} onCheckedChange={setDeductible} id="deductible" />
              <div className="space-y-1">
                <Label htmlFor="deductible">Deduct from Zakatable Wealth</Label>
                <p className="text-xs text-muted-foreground">Only short-term debts or immediate payouts should be deducted, not full long-term mortgages.</p>
              </div>
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
