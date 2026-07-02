import { cn } from "@/lib/utils";

export function Logo({ className, imageClassName }: { className?: string; imageClassName?: string }) {
  return (
    <div className={cn("flex items-center justify-center select-none", className)}>
      <img
        src="/assets/logoRectangle.png"
        alt="SparkOn Driving Academy"
        className={cn("h-auto w-[240px] max-w-full", imageClassName)}
      />
    </div>
  );
}
