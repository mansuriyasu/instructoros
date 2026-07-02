'use client';

import { useFinance } from '@/hooks/use-finance';
import { ZakatYear } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, TrendingUp, HandCoins, Landmark, Coins, AlertTriangle } from 'lucide-react';
import { useMemo } from 'react';

interface FinanceDashboardProps {
  activeYear: ZakatYear;
}

export function FinanceDashboard({ activeYear }: FinanceDashboardProps) {
  const { assets, liabilities, payments, loans, spending } = useFinance();

  const metrics = useMemo(() => {
    // 1. Assets
    const yearAssets = assets?.filter(a => a.yearId === activeYear.id) || [];
    const totalAssets = yearAssets.reduce((sum, a) => sum + a.valueInCAD, 0);
    const totalZakatableAssets = yearAssets.reduce((sum, a) => sum + a.zakatableValue, 0);
    const cashOnHand = yearAssets.filter(a => a.category === 'Cash').reduce((sum, a) => sum + a.valueInCAD, 0);

    // 2. Liabilities
    const yearLiabilities = liabilities?.filter(l => l.yearId === activeYear.id) || [];
    const totalLiabilities = yearLiabilities.reduce((sum, l) => sum + l.valueInCAD, 0);
    const deductibleLiabilities = yearLiabilities.filter(l => l.deductible).reduce((sum, l) => sum + l.valueInCAD, 0);

    // 3. Loans Receivable (Global, but let's just sum all Open/Partial "gave" loans)
    const loansReceivable = (loans || [])
      .filter(l => l.type === 'gave' && l.status !== 'Paid')
      .reduce((sum, l) => sum + (l.remainingBalance * (l.currency === 'INR' ? (1 / activeYear.exchangeRateINR) : 1)), 0);

    // 4. Big Spending Total (Global for this year?)
    const yearSpending = (spending || []).filter(s => s.date.startsWith(activeYear.zakatDate.substring(0, 4)));
    const totalSpending = yearSpending.reduce((sum, s) => sum + (s.amount * (s.currency === 'INR' ? (1 / activeYear.exchangeRateINR) : 1)), 0);

    // 5. Zakat Payments
    const yearPayments = payments?.filter(p => p.yearId === activeYear.id) || [];
    const totalPaid = yearPayments.reduce((sum, p) => sum + p.valueInCAD, 0);

    // 6. Net Zakatable Wealth
    const netZakatableWealth = totalZakatableAssets - deductibleLiabilities;

    // 7. Nisab
    const nisabGrams = activeYear.nisabMethod === 'gold' ? 85 : 595;
    const nisabValue = nisabGrams * (activeYear.nisabMethod === 'gold' ? activeYear.goldPrice : activeYear.silverPrice);

    // 8. Zakat Due
    const zakatDue = netZakatableWealth >= nisabValue ? netZakatableWealth * 0.025 : 0;
    const zakatRemaining = zakatDue - totalPaid;

    return {
      totalAssets,
      totalZakatableAssets,
      cashOnHand,
      totalLiabilities,
      deductibleLiabilities,
      loansReceivable,
      totalSpending,
      totalPaid,
      netZakatableWealth,
      nisabValue,
      zakatDue,
      zakatRemaining,
    };
  }, [activeYear, assets, liabilities, payments, loans, spending]);

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('en-CA', { style: 'currency', currency: activeYear.baseCurrency }).format(amount);
  };

  return (
    <div className="space-y-4">
      {/* Islamic Note */}
      <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-4 text-sm flex gap-3 items-start">
        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
        <p>
          <strong>Islamic Note:</strong> This calculator follows the general Islamic Zakat method of 2.5% on zakatable wealth above Nisab. 
          For RRSP, pension, business inventory, complex investments, or disputed matters, please confirm with a trusted scholar.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Zakat Cards */}
        <Card className="bg-emerald-50 border-emerald-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-emerald-800">Zakat Due (2.5%)</CardTitle>
            <HandCoins className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-900">{formatMoney(metrics.zakatDue)}</div>
            <p className="text-xs text-emerald-700 mt-1">Based on Net Zakatable Wealth</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Zakat Paid</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(metrics.totalPaid)}</div>
            <p className="text-xs text-muted-foreground mt-1">Remaining: {formatMoney(metrics.zakatRemaining)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Net Zakatable Wealth</CardTitle>
            <Landmark className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(metrics.netZakatableWealth)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Threshold (Nisab): {formatMoney(metrics.nisabValue)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Assets (Gross)</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(metrics.totalAssets)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Liabilities: {formatMoney(metrics.totalLiabilities)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Cash on Hand</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatMoney(metrics.cashOnHand)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Loans Given</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatMoney(metrics.loansReceivable)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Spending ({activeYear.zakatDate.substring(0, 4)})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-red-500" />
              {formatMoney(metrics.totalSpending)}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
