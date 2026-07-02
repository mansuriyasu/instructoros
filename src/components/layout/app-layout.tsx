import { Header } from "./header";
import { BottomNav } from "./bottom-nav";
import { Sidebar } from "./sidebar";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#F5F5F5]">
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <Header />
        <main className="flex flex-1 flex-col gap-4 p-4 pb-24 md:pb-6 md:px-8 md:pt-6 lg:px-[30px] lg:pt-[26px] lg:pb-[60px]">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
