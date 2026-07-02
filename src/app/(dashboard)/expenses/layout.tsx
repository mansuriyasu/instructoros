"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { PieChart, Plus, List } from "lucide-react"

export default function ExpensesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  const navItems = [
    { href: "/expenses", label: "Dashboard", icon: PieChart, exact: true },
    { href: "/expenses/add", label: "Add Expense", icon: Plus, exact: false },
    { href: "/expenses/list", label: "History", icon: List, exact: false },
  ]

  return (
    <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto animate-in fade-in duration-500">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0D1B2A] to-[#1E3A8A] dark:from-[#0D1B2A] dark:to-[#0a1520] p-6 sm:p-8 text-white shadow-lg">
        <div className="relative z-10">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2 text-white">Business Expenses</h1>
          <p className="text-blue-100/80 max-w-xl text-sm sm:text-base">
            Track and manage your driving academy costs with real-time insights.
          </p>
        </div>
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-20 w-40 h-40 bg-[#F0D080]/10 rounded-full blur-2xl -mb-10"></div>
      </div>

      <nav className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mt-2">
        {navItems.map((item) => {
          const isActive = item.exact 
            ? pathname === item.href 
            : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 whitespace-nowrap",
                isActive
                  ? "bg-[#0D1B2A] text-[#F0D080] dark:bg-[#C9A84C] dark:text-[#0D1B2A] shadow-md scale-105"
                  : "bg-white/50 dark:bg-muted/50 text-muted-foreground hover:bg-white dark:hover:bg-muted hover:shadow-sm hover:text-foreground"
              )}
            >
              <item.icon className={cn("w-4 h-4", isActive ? "animate-pulse" : "")} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <main className="flex-1 w-full">
        {children}
      </main>
    </div>
  )
}
