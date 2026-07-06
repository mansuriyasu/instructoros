"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/admin/utility-tracker", label: "Dashboard" },
  { href: "/admin/utility-tracker/enter-data", label: "Enter Data" },
  { href: "/admin/utility-tracker/data-tables", label: "Data Tables" },
  { href: "/admin/utility-tracker/settings", label: "Settings" },
]

export default function UtilityTrackerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 max-w-7xl mx-auto w-full pb-24 md:pb-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-[#0D1B2A] dark:text-white">
          Utility Tracker
        </h1>
        <p className="text-muted-foreground">
          Manage your landlord home finance and track cash flows.
        </p>
      </div>

      <nav className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors",
                isActive
                  ? "bg-[#0D1B2A] text-[#C9A84C] shadow-sm dark:bg-[#C9A84C] dark:text-[#0D1B2A]"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="min-h-[500px]">
        {children}
      </div>
    </div>
  )
}
