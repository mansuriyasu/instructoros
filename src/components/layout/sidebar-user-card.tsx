"use client";

import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { LogOut } from "lucide-react";
import { useAuth, useUser } from "@/firebase";

export function SidebarUserCard() {
  const auth = useAuth();
  const { user } = useUser();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(auth);
    router.replace("/login");
  };

  const name = user?.displayName || user?.email?.split("@")[0] || "Instructor";
  const initials = name
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="mx-[14px] mb-[14px] flex items-center gap-[11px] rounded-[14px] bg-[#F7F7F6] p-3">
      <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#2C3038] to-[#15171C] text-[14px] font-bold text-white">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-bold text-[#191B20]">{name}</p>
        <p className="text-[11.5px] text-[#8A8E96]">Instructor</p>
      </div>
      <button
        onClick={handleLogout}
        className="shrink-0 text-[#A0A4AC] transition-colors hover:text-[#191B20]"
        aria-label="Logout"
      >
        <LogOut className="h-[17px] w-[17px]" strokeWidth={2} />
      </button>
    </div>
  );
}
