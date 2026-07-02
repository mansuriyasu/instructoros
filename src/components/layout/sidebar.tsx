import { SidebarNav } from "./sidebar-nav";
import { SidebarUserCard } from "./sidebar-user-card";
import { Logo } from "@/components/logo";

export function Sidebar() {
  return (
    <aside className="hidden md:flex sticky top-0 h-screen w-[248px] shrink-0 flex-col border-r border-[#ECECEC] bg-white">
      <Logo className="justify-start px-[22px] pb-5 pt-[22px]" imageClassName="w-[178px]" />

      {/* Nav */}
      <div className="flex-1 overflow-y-auto">
        <SidebarNav />
      </div>

      {/* User card */}
      <SidebarUserCard />
    </aside>
  );
}
