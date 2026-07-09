"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3 sm:p-4", className)}
      classNames={{
        months: "flex flex-col gap-4 sm:flex-row sm:gap-5",
        month: "space-y-4",
        caption: "relative flex items-center justify-center pt-1",
        caption_label: "text-base font-bold",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-9 w-9 rounded-full bg-transparent p-0 opacity-70 hover:opacity-100"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse",
        head_row: "grid grid-cols-7",
        head_cell:
          "flex h-9 items-center justify-center rounded-md text-xs font-semibold text-muted-foreground",
        row: "grid grid-cols-7 gap-1 mt-1",
        cell: "relative flex aspect-square items-center justify-center p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected].day-range-end)]:rounded-2xl [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:rounded-2xl [&:has([aria-selected])]:bg-accent",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-full w-full rounded-2xl p-0 font-semibold aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-primary/10 text-primary",
        day_outside:
          "day-outside text-muted-foreground/60 aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ className, orientation, ...props }: any) => {
          if (orientation === "left") {
            return <ChevronLeft className={cn("h-4 w-4", className)} {...props} />
          }
          return <ChevronRight className={cn("h-4 w-4", className)} {...props} />
        }
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
