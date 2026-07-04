"use client";

import { Header } from "./header";
import { BottomNav } from "./bottom-nav";
import { Sidebar } from "./sidebar";
import Link from "next/link";
import { Lock } from "lucide-react";
import { useSession } from "@/firebase";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { tenant, canManageTenant } = useSession();

  return (
    <div className="flex min-h-screen bg-[#F5F5F5]">
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <Header />
        {tenant?.billingLocked && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 md:px-8">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 font-semibold">
                <Lock className="h-4 w-4" />
                This workspace is read-only until billing is active.
              </div>
              {canManageTenant && (
                <Link href="/app/billing" className="font-black underline underline-offset-4">
                  Fix billing
                </Link>
              )}
            </div>
          </div>
        )}
        <main className="flex flex-1 flex-col gap-4 p-4 pb-24 md:pb-6 md:px-8 md:pt-6 lg:px-[30px] lg:pt-[26px] lg:pb-[60px]">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
