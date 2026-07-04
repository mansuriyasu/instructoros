import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

export function Logo({ className, imageClassName }: { className?: string; imageClassName?: string }) {
  return (
    <div className={cn("flex items-center justify-center gap-3 select-none", className)}>
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#111827] text-[#facc15]">
        <Sparkles className="h-5 w-5" />
      </span>
      <span className={cn("text-2xl font-black tracking-normal text-[#111827]", imageClassName)}>
        InstructorOS
      </span>
    </div>
  );
}
