'use client';

import { useState } from 'react';
import { ZakatYear } from '@/lib/types';
import { useFinance } from '@/hooks/use-finance';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Plus, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface YearSelectorProps {
  years: ZakatYear[];
  activeYearId: string;
  onSelectYear: (id: string) => void;
}

export function YearSelector({ years, activeYearId, onSelectYear }: YearSelectorProps) {
  const { addYear, copyAssetsToNewYear } = useFinance();
  const { toast } = useToast();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [zakatDate, setZakatDate] = useState('');
  const [baseCurrency, setBaseCurrency] = useState('CAD');
  const [nisabMethod, setNisabMethod] = useState<'gold' | 'silver'>('silver');
  const [goldPrice, setGoldPrice] = useState('');
  const [silverPrice, setSilverPrice] = useState('');
  const [exchangeRateINR, setExchangeRateINR] = useState('');
  
  const [copyFromYear, setCopyFromYear] = useState<string>('none');

  const handleOpenDialog = () => {
    setName(`Zakat ${new Date().getFullYear()}`);
    setZakatDate(new Date().toISOString().split('T')[0]);
    setBaseCurrency('CAD');
    setNisabMethod('silver');
    setGoldPrice('');
    setSilverPrice('');
    setExchangeRateINR('');
    setCopyFromYear('none');
    setIsDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!name || !zakatDate || !goldPrice || !silverPrice || !exchangeRateINR) {
      toast({ title: 'Missing fields', description: 'Please fill out all pricing and dates.', variant: 'destructive' });
      return;
    }

    setIsProcessing(true);
    try {
      const yearDoc = await addYear({
        name,
        zakatDate,
        baseCurrency,
        nisabMethod,
        goldPrice: Number(goldPrice),
        silverPrice: Number(silverPrice),
        exchangeRateINR: Number(exchangeRateINR),
      });

      if (yearDoc && copyFromYear !== 'none') {
        await copyAssetsToNewYear(copyFromYear, yearDoc.id);
        toast({ title: 'Assets copied successfully' });
      }

      toast({ title: 'Year created successfully' });
      setIsDialogOpen(false);
      if (yearDoc) onSelectYear(yearDoc.id);
    } catch (err) {
      toast({ title: 'Error', description: String(err), variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={activeYearId} onValueChange={(val) => {
        if (val === 'NEW') handleOpenDialog();
        else onSelectYear(val);
      }}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Select Year" />
        </SelectTrigger>
        <SelectContent>
          {years.map(y => (
            <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>
          ))}
          <SelectItem value="NEW" className="text-primary font-medium">
            + Create New Year
          </SelectItem>
        </SelectContent>
      </Select>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Zakat Year</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Year Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Zakat 2026" />
              </div>
              <div className="space-y-2">
                <Label>Zakat Date</Label>
                <Input value={zakatDate} onChange={e => setZakatDate(e.target.value)} type="date" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Gold Price per gram ({baseCurrency})</Label>
                <Input value={goldPrice} onChange={e => setGoldPrice(e.target.value)} type="number" step="0.01" />
              </div>
              <div className="space-y-2">
                <Label>Silver Price per gram ({baseCurrency})</Label>
                <Input value={silverPrice} onChange={e => setSilverPrice(e.target.value)} type="number" step="0.01" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nisab Method</Label>
                <RadioGroup value={nisabMethod} onValueChange={(v: 'gold'|'silver') => setNisabMethod(v)} className="flex gap-4 mt-2">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="silver" id="r1" />
                    <Label htmlFor="r1">Silver</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="gold" id="r2" />
                    <Label htmlFor="r2">Gold</Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="space-y-2">
                <Label>Exchange Rate (1 CAD to INR)</Label>
                <Input value={exchangeRateINR} onChange={e => setExchangeRateINR(e.target.value)} type="number" step="0.01" />
              </div>
            </div>

            {years.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <Label>Copy Assets From Previous Year</Label>
                <Select value={copyFromYear} onValueChange={setCopyFromYear}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Don't copy assets</SelectItem>
                    {years.map(y => (
                      <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">This will clone your assets list. You can update values later.</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={isProcessing}>
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Year
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
