'use client';

import { Calendar, CreditCard, History, Home, Shield, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useSession } from '@/firebase';
import type { AppRole } from '@/lib/auth-config';

export function BottomNav() {
  const pathname = usePathname();
  const { role, activeTenantId } = useSession();

  const navItems = [
    { href: "/app", label: "Home", icon: Home, roles: ["schoolAdmin", "schoolInstructor", "soloInstructor", "mainAdmin"] },
    { href: "/admin", label: "Admin", icon: Shield, roles: ["mainAdmin"] },
    { href: "/app/students", label: "Students", icon: Users, roles: ["schoolAdmin", "schoolInstructor", "soloInstructor", "mainAdmin"] },
    { href: "/app/schedule", label: "Schedule", icon: Calendar, roles: ["schoolAdmin", "schoolInstructor", "soloInstructor", "mainAdmin"] },
    { href: "/app/payments", label: "POS", icon: CreditCard, roles: ["schoolAdmin", "schoolInstructor", "soloInstructor", "mainAdmin"] },
    { href: "/app/payments/history", label: "History", icon: History, roles: ["schoolAdmin", "schoolInstructor", "soloInstructor", "mainAdmin"] },
  ].filter(item => {
    if (!role || !(item.roles as AppRole[]).includes(role)) return false;
    if (role === "mainAdmin" && !activeTenantId && item.href !== "/admin") return false;
    return true;
  }).slice(0, 5);

  // Pick the most specific match so /app/payments/history highlights History, not POS too.
  const activeHref = navItems
    .filter(item => item.href === '/app' ? pathname === '/app' : pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <div className="fixed bottom-0 left-0 z-50 w-full bg-background border-t lg:hidden pb-[env(safe-area-inset-bottom)]">
      <div className="grid h-[68px] w-full grid-cols-5 font-medium px-1">
        {navItems.map(item => {
          const isActive = item.href === activeHref;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 transition-[color,transform] duration-150 ease-out active:scale-[0.94]",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground [@media(hover:hover)]:hover:text-foreground"
              )}
            >
              <item.icon className={cn("w-6 h-6", isActive ? "stroke-[2.5] text-[#e6a100]" : "stroke-2")} />
              <span className={cn("text-[10px] font-semibold", isActive ? "" : "font-medium")}>{item.label}</span>
              {isActive && (
                <span className="absolute bottom-1 w-8 h-[3px] rounded-full bg-[#ffb300]" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
