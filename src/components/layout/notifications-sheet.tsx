'use client';

import { useMemo, type ReactNode } from 'react';
import { Bell, Copy } from 'lucide-react';
import { addDays, isSameDay, isWithinInterval, parse, startOfDay } from 'date-fns';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useStudents } from '@/hooks/use-students';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Student } from '@/lib/types';

interface NotificationsSheetProps {
  className?: string;
  triggerType?: 'button' | 'icon' | 'tile';
}

export function NotificationsSheet({ className, triggerType = 'button' }: NotificationsSheetProps) {
  const { students } = useStudents();
  const { toast } = useToast();

  const notifications = useMemo(() => {
    if (!students) return { expiringLicenses: [], upcomingBirthdays: [] };

    const today = new Date();
    const todayStart = startOfDay(today);
    const tomorrow = addDays(todayStart, 1);
    const thirtyDaysFromNow = addDays(today, 30);

    const expiringLicenses = students.filter((student) => {
      try {
        const expiryDate = parse(student.licenseExpiry, 'yyyyMMdd', new Date());
        return isWithinInterval(expiryDate, {
          start: today,
          end: thirtyDaysFromNow,
        });
      } catch (e) {
        return false;
      }
    });

    const upcomingBirthdays = students.filter((student) => {
      try {
        const birthDate = parse(student.birthdate, 'yyyyMMdd', new Date());
        const thisYearBirthday = new Date(
          todayStart.getFullYear(),
          birthDate.getMonth(),
          birthDate.getDate()
        );
        const nextYearBirthday = new Date(
          todayStart.getFullYear() + 1,
          birthDate.getMonth(),
          birthDate.getDate()
        );

        return [thisYearBirthday, nextYearBirthday].some((birthday) =>
          isSameDay(birthday, todayStart) || isSameDay(birthday, tomorrow)
        );
      } catch (e) {
        return false;
      }
    });

    return { expiringLicenses, upcomingBirthdays };
  }, [students]);

  const totalNotifications =
    notifications.expiringLicenses.length + notifications.upcomingBirthdays.length;

  const handleCopyBirthdayWish = async (student: Student) => {
    const firstName = student.name.split(' ')[0] || student.name;
    const wish = `Happy birthday, ${firstName}! Wishing you a wonderful year ahead filled with happiness, success, and safe drives. Have an amazing day! - InstructorOS`;
    await navigator.clipboard.writeText(wish);
    toast({ title: 'Birthday wish copied' });
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        {triggerType === 'icon' ? (
          <button
            className={cn(
              'relative rounded-full p-2 outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              className
            )}
            aria-label="Notifications"
          >
            <Bell className="h-6 w-6" />
            {totalNotifications > 0 && (
              <span className="absolute right-0 top-0 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#ffb300] px-1 text-[10px] font-bold text-white ring-2 ring-background">
                {totalNotifications}
              </span>
            )}
          </button>
        ) : triggerType === 'tile' ? (
          <button
            type="button"
            className={cn(
              'relative flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl border border-[#FFD1D7] bg-[#FFF1F2] p-3 text-center shadow-sm transition-transform outline-none active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              className
            )}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E11D48] text-white">
              <Bell className="h-5 w-5" />
            </span>
            <span className="text-xs font-bold leading-tight text-foreground">Notifications</span>
            {totalNotifications > 0 && (
              <span className="absolute right-2 top-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-bold text-destructive-foreground">
                {totalNotifications}
              </span>
            )}
          </button>
        ) : (
          <Button
            variant="ghost"
            className={cn(
              'relative flex w-full justify-start gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary',
              className
            )}
          >
            <Bell className="h-4 w-4" />
            <span>Notifications</span>
            {totalNotifications > 0 && (
              <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 text-xs text-destructive-foreground">
                {totalNotifications}
              </span>
            )}
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[60%]">
        <SheetHeader>
          <SheetTitle>Notifications</SheetTitle>
        </SheetHeader>
        <ScrollArea className="mt-4 h-[calc(100%-4rem)]">
          <div className="space-y-6">
            <NotificationSection
              title="Expiring Licenses"
              items={notifications.expiringLicenses}
              renderItem={(student) =>
                `Expires on ${student.licenseExpiry.replace(
                  /(\d{4})(\d{2})(\d{2})/,
                  '$2/$3/$1'
                )}`
              }
            />
            <NotificationSection
              title="Upcoming Birthdays"
              items={notifications.upcomingBirthdays}
              renderItem={(student) =>
                `Birthday on ${student.birthdate.replace(
                  /(\d{4})(\d{2})(\d{2})/,
                  '$2/$3'
                )}`
              }
              renderAction={(student) => (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 flex-shrink-0"
                  onClick={() => handleCopyBirthdayWish(student)}
                  aria-label={`Copy birthday wish for ${student.name}`}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              )}
            />
            {totalNotifications === 0 && (
              <p className="text-sm text-muted-foreground">No notifications.</p>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

interface NotificationSectionProps {
  title: string;
  items: Student[];
  renderItem: (student: Student) => string;
  renderAction?: (student: Student) => ReactNode;
}

function NotificationSection({
  title,
  items,
  renderItem,
  renderAction,
}: NotificationSectionProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div>
      <h3 className="mb-3 font-semibold">{title}</h3>
      <div className="space-y-3">
        {items.map((student) => (
          <div key={student.id} className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback>{student.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="text-sm font-medium">{student.name}</p>
              <p className="text-xs text-muted-foreground">
                {renderItem(student)}
              </p>
            </div>
            {renderAction?.(student)}
          </div>
        ))}
      </div>
    </div>
  );
}
