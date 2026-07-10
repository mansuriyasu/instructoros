import { cn } from "@/lib/utils";
import Image from "next/image";

export function Logo({ className, imageClassName }: { className?: string; imageClassName?: string }) {
  return (
    <div className={cn("flex items-center justify-center select-none", className)}>
      <Image
        src="/assets/instructoros-logo.png"
        alt="InstructorOS"
        width={1373}
        height={263}
        priority
        className={cn("h-auto w-[170px] max-w-full object-contain", imageClassName)}
      />
    </div>
  );
}
