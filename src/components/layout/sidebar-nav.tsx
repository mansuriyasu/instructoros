"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Home,
  Users,
  Wallet,
  History,
  Calendar,
  Activity,
  Receipt,
  Settings,
} from "lucide-react"

export const navItems = [
  { href: "/", label: "Home", icon: Home, exact: true },
  { href: "/students", label: "Students", icon: Users },
  { href: "/payments", label: "POS", icon: Wallet, match: "/payments" },
  { href: "/payments/history", label: "History", icon: History },
  { href: "/schedule", label: "Schedule", icon: Calendar },
  { href: "/expenses", label: "Business Expenses", icon: Receipt },
  { href: "/utility-tracker", label: "Utility Tracker", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function SidebarNav() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-[3px] px-[14px] py-[6px]">
      {navItems.map(({ href, label, icon: Icon, exact, match }) => {
        const isActive = exact
          ? pathname === href
          : match
            ? pathname.startsWith(match) && !(label === "POS" && pathname.startsWith("/payments/history"))
            : pathname.startsWith(href)

        return (
          <Link
            key={label}
            href={href}
            className={cn(
              "relative flex items-center gap-3 h-[42px] px-3 rounded-[11px] text-[14px] transition-colors",
              isActive
                ? "bg-[#FFF8E7] text-[#191B20] font-bold"
                : "text-[#6B7280] font-normal hover:bg-gray-50 hover:text-[#191B20]"
            )}
          >
            {isActive && (
              <span className="absolute -left-[3px] top-[11px] bottom-[11px] w-[3px] rounded-full bg-[#FACC15]" />
            )}
            <Icon className={cn("w-[19px] h-[19px] shrink-0", isActive ? "stroke-[#191B20]" : "stroke-[#9CA3AF]")} strokeWidth={1.9} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
