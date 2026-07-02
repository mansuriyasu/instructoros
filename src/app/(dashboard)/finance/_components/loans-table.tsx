'use client';

import { useState } from 'react';
import { useFinance } from '@/hooks/use-finance';
import { FinanceLoan } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function LoansTable() {
  const { loans, addLoan, updateLoan, deleteLoan } = useFinance();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [personName, setPersonName] = useState('');
  const [type, setType] = useState<'gave'|'borrowed'>('gave');
  const [originalAmount, setOriginalAmount] = useState('');
  const [amountPaid, setAmountPaid] = useState('0');
  const [currency, setCurrency] = useState('CAD');
  const [date, setDate] = useState('');
  const [status, setStatus] = useState<'Open'|'Partial'|'Paid'>('Open');
  const [notes, setNotes] = useState('');

  const sortedLoans = [...(loans || [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleOpen = (loan?: FinanceLoan) => {
    if (loan) {
      setEditingId(loan.id);
      setPersonName(loan.personName);
      setType(loan.type);
      setOriginalAmount(loan.originalAmount.toString());
      setAmountPaid(loan.amountPaid.toString());
      setCurrency(loan.currency);
      setDate(loan.date);
      setStatus(loan.status);
      setNotes(loan.notes || '');
    } else {
      setEditingId(null);
      setPersonName('');
      setType('gave');
      setOriginalAmount('');
      setAmountPaid('0');
      setCurrency('CAD');
      setDate(new Date().toISOString().split('T')[0]);
      setStatus('Open');
      setNotes('');
    }
    setIsOpen(true);
  };

  const handleSave = async () => {
    const orig = Number(originalAmount);
    const paid = Number(amountPaid);
    const remainingBalance = orig - paid;

    let computedStatus = status;
    if (remainingBalance <= 0) computedStatus = 'Paid';
    else if (paid > 0 && remainingBalance > 0) computedStatus = 'Partial';
    else computedStatus = 'Open';

    const data = {
      personName, type, originalAmount: orig, amountPaid: paid, remainingBalance,
      currency, date, status: computedStatus, notes
    };

    if (editingId) {
      await updateLoan({ id: editingId, ...data });
    } else {
      await addLoan(data);
    }
    setIsOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => handleOpen()}><Plus className="w-4 h-4 mr-2"/> Add Loan</Button>
      </div>

      <div className="border rounded-lg bg-white overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Person Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Original Amount</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Remaining</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedLoans.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No loans recorded.</TableCell>
              </TableRow>
            ) : (
              sortedLoans.map(l => (
                <TableRow key={l.id}>
                  <TableCell>{l.date}</TableCell>
                  <TableCell className="font-medium">{l.personName}</TableCell>
                  <TableCell>
                    {l.type === 'gave' ? <span className="text-emerald-600 font-medium">I Gave</span> : <span className="text-amber-600 font-medium">I Borrowed</span>}
                  </TableCell>
                  <TableCell className="text-right">{l.originalAmount.toLocaleString()} {l.currency}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{l.amountPaid.toLocaleString()} {l.currency}</TableCell>
                  <TableCell className="text-right font-medium">{l.remainingBalance.toLocaleString()} {l.currency}</TableCell>
                  <TableCell>
                    {l.status === 'Paid' ? (
                        <span className="bg-emerald-100 text-emerald-800 px-2 py-1 rounded text-xs">Paid</span>
                    ) : l.status === 'Partial' ? (
                        <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded text-xs">Partial</span>
                    ) : (
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">Open</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleOpen(l)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-red-500" onClick={() => deleteLoan(l.id)}><Trash2 className="w-4 h-4" /></Button>
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
          <DialogHeader><DialogTitle>{editingId ? 'Edit' : 'Add'} Loan</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Person Name</Label>
              <Input value={personName} onChange={e => setPersonName(e.target.value)} placeholder="John Doe" />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            
            <div className="space-y-2">
              <Label>Loan Type</Label>
              <Select value={type} onValueChange={(v: 'gave'|'borrowed') => setType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gave">I Gave (Asset)</SelectItem>
                  <SelectItem value="borrowed">I Borrowed (Liability)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CAD">CAD</SelectItem>
                  <SelectItem value="INR">INR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Original Amount</Label>
              <Input type="number" value={originalAmount} onChange={e => setOriginalAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Amount Paid Back</Label>
              <Input type="number" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} />
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
