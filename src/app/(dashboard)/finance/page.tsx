'use client';

import { useState } from 'react';
import { useFinance } from '@/hooks/use-finance';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FinanceDashboard } from './_components/finance-dashboard';
import { YearSelector } from './_components/year-selector';
import { AssetsTable } from './_components/assets-table';
import { LiabilitiesTable } from './_components/liabilities-table';
import { LoansTable } from './_components/loans-table';
import { PaymentsTable } from './_components/payments-table';
import { SpendingTable } from './_components/spending-table';
import { Skeleton } from '@/components/ui/skeleton';

export default function FinancePage() {
  const { years, loading } = useFinance();
  const [activeYearId, setActiveYearId] = useState<string>('');

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-12 w-full max-w-sm" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  // Auto-select latest year if not set
  if (!activeYearId && years && years.length > 0) {
    // Sort descending by name (e.g. Zakat 2026 > Zakat 2025)
    const sorted = [...years].sort((a, b) => b.name.localeCompare(a.name));
    setActiveYearId(sorted[0].id);
  }

  const activeYear = years?.find((y) => y.id === activeYearId);

  return (
    <div className="flex h-full flex-col p-4 md:p-6 pb-24">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Money Management</h1>
          <p className="text-muted-foreground">Track your assets, liabilities, loans, and Zakat.</p>
        </div>
        <YearSelector
          years={years || []}
          activeYearId={activeYearId}
          onSelectYear={setActiveYearId}
        />
      </div>

      {!activeYear ? (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed bg-muted/20">
          <p className="text-muted-foreground text-center p-6">
            Please create a Zakat Year to start tracking your finances. <br/>
            Click the year dropdown above and select "Create New Year".
          </p>
        </div>
      ) : (
        <Tabs defaultValue="dashboard" className="flex-1 flex flex-col">
          <TabsList className="w-full flex-wrap justify-start h-auto p-1 bg-muted/50">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="assets">Assets</TabsTrigger>
            <TabsTrigger value="liabilities">Liabilities</TabsTrigger>
            <TabsTrigger value="zakat">Zakat Payments</TabsTrigger>
            <TabsTrigger value="loans">Loans (Global)</TabsTrigger>
            <TabsTrigger value="spending">Spending (Global)</TabsTrigger>
          </TabsList>
          
          <div className="flex-1 mt-4">
            <TabsContent value="dashboard" className="h-full m-0">
              <FinanceDashboard activeYear={activeYear} />
            </TabsContent>
            
            <TabsContent value="assets" className="h-full m-0">
              <AssetsTable activeYear={activeYear} />
            </TabsContent>
            
            <TabsContent value="liabilities" className="h-full m-0">
              <LiabilitiesTable activeYear={activeYear} />
            </TabsContent>
            
            <TabsContent value="zakat" className="h-full m-0">
              <PaymentsTable activeYear={activeYear} />
            </TabsContent>

            <TabsContent value="loans" className="h-full m-0">
              <LoansTable />
            </TabsContent>

            <TabsContent value="spending" className="h-full m-0">
              <SpendingTable />
            </TabsContent>
          </div>
        </Tabs>
      )}
    </div>
  );
}
