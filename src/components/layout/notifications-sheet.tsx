'use client';

import { useMemo, type ReactNode } from 'react';
import { Bell, Check, CheckCheck, Copy, UserPlus } from 'lucide-react';
import { addDays, formatDistanceToNow, isSameDay, isWithinInterval, parse, startOfDay } from 'date-fns';
import { collection, doc, limit, orderBy, query, updateDoc } from 'firebase/firestore';
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
import { useCollection, useFirestore, useMemoFirebase, useSession, useTenantCollectionPath } from '@/firebase';
import { cn } from '@/lib/utils';
import { Student, TenantNotification } from '@/lib/types';

interface NotificationsSheetProps {
  className?: string;
  triggerType?: 'button' | 'icon' | 'tile';
}

export function NotificationsSheet({ className, triggerType = 'button' }: NotificationsSheetProps) {
  const { students } = useStudents();
  const { toast } = useToast();
  const { activeTenantId, tenant, user } = useSession();
  const firestore = useFirestore();
  const notificationsPath = useTenantCollectionPath('notifications');
  const notificationsQuery = useMemoFirebase(
    () =>
      firestore && notificationsPath
        ? query(
            collection(firestore, notificationsPath),
            orderBy('createdAt', 'desc'),
            limit(20)
          )
        : null,
    [firestore, notificationsPath]
  );
  const { data: tenantNotifications } =
    useCollection<TenantNotification>(notificationsQuery);

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
    (tenantNotifications || []).filter((item) => item.status !== 'read').length;

  const handleCopyBirthdayWish = async (student: Student) => {
    const firstName = student.name.split(' ')[0] || student.name;
    const senderName = tenant?.messageSenderName || tenant?.receiptBusinessName || tenant?.name || 'Your driving instructor';
    const wish = `Happy birthday, ${firstName}! Wishing you a wonderful year ahead filled with happiness, success, and safe drives. Have an amazing day! - ${senderName}`;
    await navigator.clipboard.writeText(wish);
    toast({ title: 'Birthday wish copied' });
  };

  const markNotificationRead = async (notificationId: string) => {
    if (!firestore || !activeTenantId || !user) return;
    await updateDoc(doc(firestore, 'tenants', activeTenantId, 'notifications', notificationId), {
      status: 'read',
      readAt: new Date().toISOString(),
      readByUid: user.uid,
    });
  };

  const markAllTenantNotificationsRead = async (notificationIds: string[]) => {
    if (!firestore || !activeTenantId || !user || notificationIds.length === 0) return;
    const readAt = new Date().toISOString();
    await Promise.all(
      notificationIds.map((notificationId) =>
        updateDoc(doc(firestore, 'tenants', activeTenantId, 'notifications', notificationId), {
          status: 'read',
          readAt,
          readByUid: user.uid,
        })
      )
    );
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
              'relative flex h-full w-full flex-col items-center justify-center gap-2 rounded-[20px] border border-[#FFD1D7] bg-[#FFF1F2] p-3 text-center shadow-elevated transition-transform outline-none active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
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
            <TenantNotificationSection
              items={tenantNotifications || []}
              onMarkRead={markNotificationRead}
              onMarkAllRead={markAllTenantNotificationsRead}
            />
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

interface TenantNotificationSectionProps {
  items: TenantNotification[];
  onMarkRead: (notificationId: string) => void;
  onMarkAllRead: (notificationIds: string[]) => void;
}

function TenantNotificationSection({
  items,
  onMarkRead,
  onMarkAllRead,
}: TenantNotificationSectionProps) {
  const registrationItems = items.filter(
    (item) => item.type === 'student-registration' && item.status !== 'read'
  );
  if (registrationItems.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-semibold">Student Registrations</h3>
        {registrationItems.length > 1 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-2"
            onClick={() => onMarkAllRead(registrationItems.map((item) => item.id))}
          >
            <CheckCheck className="h-4 w-4" />
            Clear all
          </Button>
        )}
      </div>
      <div className="space-y-3">
        {registrationItems.map((item) => {
          const createdAt = item.createdAt ? new Date(item.createdAt) : null;
          const timeLabel =
            createdAt && !Number.isNaN(createdAt.getTime())
              ? `${formatDistanceToNow(createdAt, { addSuffix: true })}`
              : 'Just now';

          return (
            <div
              key={item.id}
              className={cn(
                'flex items-start gap-3 rounded-xl border p-3',
                item.severity === 'warning'
                  ? 'border-amber-200 bg-amber-50'
                  : 'border-border bg-muted/30'
              )}
            >
              <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#ffb300]/15 text-[#b77900]">
                <UserPlus className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.message}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {timeLabel}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 flex-shrink-0 gap-2 bg-background"
                onClick={() => onMarkRead(item.id)}
                aria-label={`Dismiss ${item.title}`}
              >
                <Check className="h-4 w-4" />
                Dismiss
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
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
