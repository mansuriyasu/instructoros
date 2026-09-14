'use client';

import { useMemo, type ReactNode } from 'react';
import { Bell, CalendarClock, Car, Check, CheckCheck, Clock3, Copy, CreditCard, UserPlus } from 'lucide-react';
import { addDays, formatDistanceToNow, isSameDay, isWithinInterval, parse, startOfDay } from 'date-fns';
import Link from 'next/link';
import { useNotifications, type InboxItem } from '@/hooks/use-notifications';
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
import { useSession } from '@/firebase';
import { cn } from '@/lib/utils';
import { Student } from '@/lib/types';

interface NotificationsSheetProps {
  className?: string;
  triggerType?: 'button' | 'icon' | 'tile';
}

export function NotificationsSheet({ className, triggerType = 'button' }: NotificationsSheetProps) {
  const { students } = useStudents();
  const { toast } = useToast();
  const { tenant } = useSession();
  const inbox = useNotifications();

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
      } catch {
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
      } catch {
        return false;
      }
    });

    return { expiringLicenses, upcomingBirthdays };
  }, [students]);

  const totalNotifications =
    notifications.expiringLicenses.length +
    notifications.upcomingBirthdays.length +
    inbox.unread;

  const handleCopyBirthdayWish = async (student: Student) => {
    const firstName = student.name.split(' ')[0] || student.name;
    const senderName = tenant?.messageSenderName || tenant?.receiptBusinessName || tenant?.name || 'Your driving instructor';
    const wish = `Happy birthday, ${firstName}! Wishing you a wonderful year ahead filled with happiness, success, and safe drives. Have an amazing day! - ${senderName}`;
    await navigator.clipboard.writeText(wish);
    toast({ title: 'Birthday wish copied' });
  };

  const markNotificationRead = async (notificationId: string) => {
    await inbox.markRead(notificationId);
  };

  const markAllTenantNotificationsRead = async () => {
    await inbox.markRead();
  };

  return (
    <Sheet onOpenChange={open => { if (open) void inbox.refresh(); }}>
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
              'group relative flex h-full w-full min-w-0 flex-col items-center gap-2 rounded-2xl px-1 py-1 text-center outline-none transition-transform hover:-translate-y-0.5 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
              className
            )}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/[0.07] text-primary transition-colors group-hover:bg-primary/[0.12] sm:h-14 sm:w-14">
              <Bell className="h-7 w-7 stroke-[1.8] sm:h-8 sm:w-8" />
            </span>
            <span className="max-w-full text-[11px] font-semibold leading-tight text-foreground sm:text-xs">Notifications</span>
            {totalNotifications > 0 && (
              <span className="absolute right-0 top-0 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-bold text-destructive-foreground sm:right-2">
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
            {inbox.error && <p role="alert" className="text-sm text-red-700">{inbox.error}</p>}
            <TenantNotificationSection
              items={inbox.items}
              onMarkRead={markNotificationRead}
              onMarkAllRead={markAllTenantNotificationsRead}
            />
            {inbox.more && <Button variant="outline" onClick={() => void inbox.more?.()}>Earlier notifications</Button>}
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
            {totalNotifications === 0 && inbox.items.length === 0 && (
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

interface TenantNotificationSectionProps {
  items: InboxItem[];
  onMarkRead: (notificationId: string) => void;
  onMarkAllRead: (notificationIds: string[]) => void;
}

function TenantNotificationSection({
  items,
  onMarkRead,
  onMarkAllRead,
}: TenantNotificationSectionProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-semibold">Recent activity</h3>
        {items.some(item => !item.read) && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-2"
            onClick={() => onMarkAllRead(items.filter(item => !item.read).map((item) => item.id))}
          >
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </Button>
        )}
      </div>
      <div className="space-y-3">
        {items.map((item) => {
          const createdAt = item.createdAt ? new Date(item.createdAt) : null;
          const timeLabel =
            createdAt && !Number.isNaN(createdAt.getTime())
              ? `${formatDistanceToNow(createdAt, { addSuffix: true })}`
              : 'Just now';

          const visual = notificationVisual(item.type);
          const Icon = visual.icon;

          return (
            <div
              key={item.id}
              className={cn(
                'flex items-start gap-3 rounded-xl border p-3',
                item.read ? 'border-border bg-muted/30' : visual.container
              )}
            >
              <span className={cn('mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full', visual.iconClass)}>
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <Link href={`/app/notifications/open?id=${item.id}`} className={cn('text-sm', item.read ? 'font-medium' : 'font-bold')}>{item.title}</Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.message}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {timeLabel}
                </p>
              </div>
              {!item.read && <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 flex-shrink-0 gap-2 bg-background"
                onClick={() => onMarkRead(item.id)}
                aria-label={`Dismiss ${item.title}`}
              >
                <Check className="h-4 w-4" />
                Read
              </Button>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function notificationVisual(type: string) {
  if (type === 'student.registered') return { icon: UserPlus, container: 'border-amber-200 bg-amber-50', iconClass: 'bg-amber-100 text-amber-700' };
  if (type === 'student.availability_updated') return { icon: Clock3, container: 'border-teal-200 bg-teal-50', iconClass: 'bg-teal-100 text-teal-700' };
  if (type === 'payment.recorded') return { icon: CreditCard, container: 'border-emerald-200 bg-emerald-50', iconClass: 'bg-emerald-100 text-emerald-700' };
  if (type === 'roadtest.upcoming') return { icon: Car, container: 'border-violet-200 bg-violet-50', iconClass: 'bg-violet-100 text-violet-700' };
  if (type.startsWith('schedule.')) return { icon: CalendarClock, container: type === 'schedule.cancelled' ? 'border-red-200 bg-red-50' : 'border-blue-200 bg-blue-50', iconClass: type === 'schedule.cancelled' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700' };
  return { icon: Bell, container: 'border-border bg-muted/30', iconClass: 'bg-muted text-muted-foreground' };
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
