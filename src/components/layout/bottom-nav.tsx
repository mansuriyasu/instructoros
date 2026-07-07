'use client';

import { BriefcaseBusiness, Calendar, CreditCard, Home, Shield, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useSession } from '@/firebase';
import type { AppRole } from '@/lib/auth-config';

export function BottomNav() {
  const pathname = usePathname();
  const { role, activeTenantId } = useSession();

  const navItems = [
    { href: "/app", label: "Home", icon: Home, activeColor: "text-[#ffb300]", roles: ["schoolAdmin", "schoolInstructor", "soloInstructor", "mainAdmin"] },
    { href: "/admin", label: "Admin", icon: Shield, roles: ["mainAdmin"] },
    { href: "/app/students", label: "Students", icon: Users, roles: ["schoolAdmin", "schoolInstructor", "soloInstructor", "mainAdmin"] },
    { href: "/app/schedule", label: "Schedule", icon: Calendar, roles: ["schoolAdmin", "schoolInstructor", "soloInstructor", "mainAdmin"] },
    { href: "/app/payments", label: "POS", icon: CreditCard, roles: ["schoolAdmin", "schoolInstructor", "soloInstructor", "mainAdmin"] },
    { href: "/app/billing", label: "Billing", icon: CreditCard, roles: ["schoolAdmin", "soloInstructor", "mainAdmin"] },
    { href: "/app/services", label: "Services", icon: BriefcaseBusiness, roles: ["schoolAdmin", "soloInstructor", "mainAdmin"] },
  ].filter(item => {
    if (!role || !(item.roles as AppRole[]).includes(role)) return false;
    if (role === "mainAdmin" && !activeTenantId && item.href !== "/admin") return false;
    return true;
  }).slice(0, 5);

  return (
    <div className="fixed bottom-0 left-0 z-50 w-full h-[68px] bg-background border-t md:hidden pb-safe">
      <div className="grid h-full w-full grid-cols-5 font-medium px-1">
        {navItems.map(item => {
          const isActive = item.href === '/app'
            ? pathname === '/app'
            : pathname.startsWith(item.href);
            
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 transition-colors relative",
                isActive
                  ? (item.activeColor || "text-primary")
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className={cn("w-6 h-6", isActive ? "stroke-[2.5]" : "stroke-2")} />
              <span className={cn("text-[10px] font-semibold", isActive ? "" : "font-medium")}>{item.label}</span>
              {isActive && item.href === '/app' && (
                <span className="absolute bottom-1 w-8 h-[3px] rounded-full bg-[#ffb300]" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
