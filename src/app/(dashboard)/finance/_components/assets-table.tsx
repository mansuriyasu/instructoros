'use client';

import { useState } from 'react';
import { useFinance } from '@/hooks/use-finance';
import { ZakatYear, FinanceAsset, AssetCategory } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AssetsTableProps {
  activeYear: ZakatYear;
}

const CATEGORIES: AssetCategory[] = ['Cash', 'Bank', 'Gold', 'Silver', 'Investment', 'TFSA', 'RRSP', 'FHSA', 'India Account', 'Loan Receivable', 'Business Inventory', 'Other'];

export function AssetsTable({ activeYear }: AssetsTableProps) {
  const { assets, addAsset, updateAsset, deleteAsset } = useFinance();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [owner, setOwner] = useState('');
  const [category, setCategory] = useState<AssetCategory>('Bank');
  const [currency, setCurrency] = useState('CAD');
  const [originalValue, setOriginalValue] = useState('');
  const [exchangeRate, setExchangeRate] = useState('1');
  const [zakatablePercentage, setZakatablePercentage] = useState('100');
  const [notes, setNotes] = useState('');

  const yearAssets = assets?.filter(a => a.yearId === activeYear.id) || [];

  const handleOpen = (asset?: FinanceAsset) => {
    if (asset) {
      setEditingId(asset.id);
      setName(asset.name);
      setOwner(asset.owner);
      setCategory(asset.category);
      setCurrency(asset.currency);
      setOriginalValue(asset.originalValue.toString());
      setExchangeRate(asset.exchangeRate.toString());
      setZakatablePercentage(asset.zakatablePercentage.toString());
      setNotes(asset.notes || '');
    } else {
      setEditingId(null);
      setName('');
      setOwner('');
      setCategory('Bank');
      setCurrency('CAD');
      setOriginalValue('');
      setExchangeRate('1');
      setZakatablePercentage('100');
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
    const val = Number(originalValue);
    const rate = Number(exchangeRate);
    const perc = Number(zakatablePercentage);
    
    const valueInCAD = val * rate;
    const zakatableValue = valueInCAD * (perc / 100);

    const data = {
      yearId: activeYear.id,
      name, owner, category, currency, 
      originalValue: val, 
      exchangeRate: rate,
      valueInCAD,
      zakatablePercentage: perc,
      zakatableValue,
      notes
    };

    if (editingId) {
      await updateAsset({ id: editingId, ...data });
    } else {
      await addAsset(data);
    }
    setIsOpen(false);
  };

  const formatMoney = (val: number) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(val);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => handleOpen()}><Plus className="w-4 h-4 mr-2"/> Add Asset</Button>
      </div>

      <div className="border rounded-lg bg-white overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asset Name</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Original Value</TableHead>
              <TableHead className="text-right">Value (CAD)</TableHead>
              <TableHead className="text-right">Zakatable %</TableHead>
              <TableHead className="text-right">Zakatable Value</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {yearAssets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No assets added for this year.</TableCell>
              </TableRow>
            ) : (
              yearAssets.map(a => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell>{a.owner}</TableCell>
                  <TableCell>{a.category}</TableCell>
                  <TableCell className="text-right">{a.originalValue.toLocaleString()} {a.currency}</TableCell>
                  <TableCell className="text-right">{formatMoney(a.valueInCAD)}</TableCell>
                  <TableCell className="text-right">{a.zakatablePercentage}%</TableCell>
                  <TableCell className="text-right font-medium">{formatMoney(a.zakatableValue)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleOpen(a)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-red-500" onClick={() => deleteAsset(a.id)}><Trash2 className="w-4 h-4" /></Button>
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
          <DialogHeader><DialogTitle>{editingId ? 'Edit' : 'Add'} Asset</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Asset Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Scotia Checking" />
            </div>
            <div className="space-y-2">
              <Label>Owner</Label>
              <Input value={owner} onChange={e => setOwner(e.target.value)} placeholder="Yasin" />
            </div>
            
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v: AssetCategory) => setCategory(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
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
              <Label>Original Value</Label>
              <Input type="number" value={originalValue} onChange={e => setOriginalValue(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Exchange Rate (to CAD)</Label>
              <Input type="number" step="0.0001" value={exchangeRate} onChange={e => setExchangeRate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Zakatable %</Label>
              <Input type="number" value={zakatablePercentage} onChange={e => setZakatablePercentage(e.target.value)} />
              <p className="text-xs text-muted-foreground">E.g., 100 for cash, 50 for RRSP (if estimating tax).</p>
            </div>
            <div className="space-y-2">
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
