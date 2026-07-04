import { Suspense } from 'react';
import { PosClientPage } from './_components/pos-client-page';
import { Skeleton } from '@/components/ui/skeleton';

export default function PaymentsPage() {
  return (
    <div className="h-full flex flex-col">
      <div className="mb-4 rounded-2xl border bg-card px-4 py-4 shadow-sm sm:px-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Checkout</p>
            <h1 className="text-2xl font-bold tracking-tight">POS</h1>
            <p className="text-sm text-muted-foreground">Add services, save bills, or record payments quickly.</p>
          </div>
          <div className="hidden rounded-2xl bg-[#111827] px-4 py-3 text-right text-white sm:block">
            <p className="text-xs text-white/60">InstructorOS</p>
            <p className="text-sm font-semibold">Payments</p>
          </div>
        </div>
      </div>
      <Suspense fallback={
        <div className="flex flex-col gap-8 flex-1">
            <Skeleton className="h-10 w-full max-w-sm" />
            <div className="grid md:grid-cols-3 gap-8 flex-1">
                <div className="md:col-span-2">
                    <Skeleton className="h-full w-full rounded-lg" />
                </div>
                <div>
                    <Skeleton className="h-full w-full rounded-lg" />
                </div>
            </div>
        </div>
      }>
        <PosClientPage />
      </Suspense>
    </div>
  );
}
