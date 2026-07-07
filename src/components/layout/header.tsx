"use client";

import { format } from "date-fns";
import { NotificationsSheet } from "./notifications-sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogoutButton } from "@/components/auth/logout-button";
import { useSession, useUser } from "@/firebase";
import { BriefcaseBusiness, CreditCard, Settings } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";

export function Header() {
  const { user } = useUser();
  const { role, tenant, canManageTenant } = useSession();
  const today = new Date();
  const dateLabel = format(today, "EEEE, MMMM d · yyyy");

  return (
    <header className="sticky top-0 z-30 flex h-[62px] items-center justify-between border-b border-[#EBEBEB] bg-[rgba(245,245,245,0.85)] px-6 backdrop-blur-[12px] md:px-8">
      {/* Date — hidden on small screens where Logo is shown instead */}
      <div className="hidden text-[13px] font-medium text-[#8A8E96] md:block">{dateLabel}</div>

      <Logo className="md:hidden" imageClassName="text-xl" />

      <div className="flex items-center gap-3">
        <NotificationsSheet triggerType="icon" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-opacity hover:opacity-80">
              <Avatar className="h-[38px] w-[38px] border border-[#E6E6E6]">
                <AvatarImage src={user?.photoURL || ""} alt={user?.displayName || "User"} />
                <AvatarFallback className="bg-gradient-to-br from-[#2C3038] to-[#15171C] text-[14px] font-bold text-white">
                  {user?.displayName
                    ? user.displayName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)
                    : "U"}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 mt-2 rounded-xl">
            <div className="flex items-center justify-start gap-2 p-2">
              <div className="flex flex-col space-y-1 leading-none">
                {user?.displayName && <p className="font-medium">{user.displayName}</p>}
                {user?.email && (
                  <p className="w-[200px] truncate text-sm text-muted-foreground">{user.email}</p>
                )}
                {(tenant?.name || role) && (
                  <p className="w-[200px] truncate text-xs text-muted-foreground">{tenant?.name || 'Main Admin'}</p>
                )}
              </div>
            </div>
            <div className="p-2 border-t mt-1 space-y-1">
              {canManageTenant && (
                <>
                  <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
                    <Link href="/app/billing">
                      <CreditCard className="mr-2 h-4 w-4" />
                      <span>Billing</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
                    <Link href="/app/services">
                      <BriefcaseBusiness className="mr-2 h-4 w-4" />
                      <span>Services</span>
                    </Link>
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
                <Link href="/app/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </Link>
              </DropdownMenuItem>
              <LogoutButton className="mt-1" />
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
