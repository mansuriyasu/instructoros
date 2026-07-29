import { SidebarNav } from "./sidebar-nav";
import { SidebarUserCard } from "./sidebar-user-card";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { Logo } from "@/components/logo";

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-border/70 bg-background lg:flex">
      <Logo className="justify-start px-[22px] pb-5 pt-[22px]" imageClassName="w-[178px]" />

      {/* Nav */}
      <div className="flex-1 overflow-y-auto">
        <SidebarNav />
      </div>

      {/* User card */}
      <WorkspaceSwitcher />
      <SidebarUserCard />
    </aside>
  );
}
