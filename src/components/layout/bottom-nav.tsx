'use client';

import { Calendar, CreditCard, Home, MoreHorizontal, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { href: "/", label: "Home", icon: Home, activeColor: "text-[#ffb300]" },
    { href: "/students", label: "Students", icon: Users },
    { href: "/schedule", label: "Schedule", icon: Calendar },
    { href: "/payments", label: "POS", icon: CreditCard },
    { href: "/settings", label: "More", icon: MoreHorizontal },
  ];

  return (
    <div className="fixed bottom-0 left-0 z-50 w-full h-[68px] bg-background border-t md:hidden pb-safe">
      <div className="grid h-full w-full grid-cols-5 font-medium px-1">
        {navItems.map(item => {
          const isActive = item.href === '/' 
            ? pathname === '/' 
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
              {isActive && item.href === '/' && (
                <span className="absolute bottom-1 w-8 h-[3px] rounded-full bg-[#ffb300]" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
