'use client';

import { useState } from 'react';
import { useFinance } from '@/hooks/use-finance';
import { FinanceSpending } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

export function SpendingTable() {
  const { spending, addSpending, updateSpending, deleteSpending } = useFinance();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [date, setDate] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('CAD');
  const [paid, setPaid] = useState(true);
  const [relatedPerson, setRelatedPerson] = useState('');
  const [notes, setNotes] = useState('');

  const sortedSpending = [...(spending || [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleOpen = (item?: FinanceSpending) => {
    if (item) {
      setEditingId(item.id);
      setDate(item.date);
      setCategory(item.category);
      setDescription(item.description);
      setAmount(item.amount.toString());
      setCurrency(item.currency);
      setPaid(item.paid);
      setRelatedPerson(item.relatedPerson || '');
      setNotes(item.notes || '');
    } else {
      setEditingId(null);
      setDate(new Date().toISOString().split('T')[0]);
      setCategory('Shopping');
      setDescription('');
      setAmount('');
      setCurrency('CAD');
      setPaid(true);
      setRelatedPerson('');
      setNotes('');
    }
    setIsOpen(true);
  };

  const handleSave = async () => {
    const val = Number(amount);

    const data = {
      date, category, description, amount: val, currency, paid, relatedPerson, notes
    };

    if (editingId) {
      await updateSpending({ id: editingId, ...data });
    } else {
      await addSpending(data);
    }
    setIsOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => handleOpen()}><Plus className="w-4 h-4 mr-2"/> Add Spending</Button>
      </div>

      <div className="border rounded-lg bg-white overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-center">Paid?</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedSpending.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No spending recorded.</TableCell>
              </TableRow>
            ) : (
              sortedSpending.map(s => (
                <TableRow key={s.id}>
                  <TableCell>{s.date}</TableCell>
                  <TableCell>{s.category}</TableCell>
                  <TableCell className="font-medium">
                    {s.description}
                    {s.relatedPerson && <span className="block text-xs text-muted-foreground">Person: {s.relatedPerson}</span>}
                  </TableCell>
                  <TableCell className="text-right font-medium">{s.amount.toLocaleString()} {s.currency}</TableCell>
                  <TableCell className="text-center">
                    {s.paid ? <span className="bg-emerald-100 text-emerald-800 px-2 py-1 rounded text-xs">Yes</span> : <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded text-xs">Unpaid</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleOpen(s)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-red-500" onClick={() => deleteSpending(s.id)}><Trash2 className="w-4 h-4" /></Button>
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
          <DialogHeader><DialogTitle>{editingId ? 'Edit' : 'Add'} Spending</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="House Maintenance" />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            
            <div className="space-y-2">
              <Label>Category</Label>
              <Input value={category} onChange={e => setCategory(e.target.value)} list="categories" placeholder="e.g. Travel" />
              <datalist id="categories">
                <option value="India Trip" />
                <option value="Tickets" />
                <option value="House Maintenance" />
                <option value="Car Insurance" />
                <option value="Shopping" />
                <option value="Umrah" />
                <option value="Hajj" />
                <option value="Car" />
                <option value="IELTS" />
                <option value="Family Support" />
              </datalist>
            </div>
            <div className="space-y-2">
              <Label>Related Person (Optional)</Label>
              <Input value={relatedPerson} onChange={e => setRelatedPerson(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Amount</Label>
              <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} />
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

            <div className="col-span-2 flex items-center space-x-3 bg-muted/50 p-3 rounded-lg border mt-2">
              <Switch checked={paid} onCheckedChange={setPaid} id="paid" />
              <div className="space-y-1">
                <Label htmlFor="paid">Mark as Paid</Label>
                <p className="text-xs text-muted-foreground">Toggle off if this is an upcoming/unpaid budget item.</p>
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
