'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CalendarEvent, LessonStatus } from '@/lib/types';
import { format } from 'date-fns';
import { CalendarCheck2, CalendarPlus, CheckCircle2, Edit, Trash2, Navigation, Clock, Image as ImageIcon, Info, User, Package, Receipt, UserX, XCircle, MessageCircle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn, getServiceColorName } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface EventDetailsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  event: CalendarEvent | null;
  onEdit: (event: CalendarEvent) => void;
  onDelete: (eventId: string) => void;
  onBookNext: (event: CalendarEvent) => void;
  onMarkPayment: (event: CalendarEvent, status: 'paid' | 'unpaid') => void;
  onMarkLessonStatus: (event: CalendarEvent, status: LessonStatus) => void;
  onSendWhatsApp?: (event: CalendarEvent) => void;
}

export function EventDetailsDialog({
  isOpen,
  onOpenChange,
  event,
  onEdit,
  onDelete,
  onBookNext,
  onMarkPayment,
  onMarkLessonStatus,
  onSendWhatsApp,
}: EventDetailsDialogProps) {
  const router = useRouter();
  const [isExamImageOpen, setIsExamImageOpen] = useState(false);

  if (!event) return null;

  const handleEdit = () => {
    onEdit(event);
  };

  const handleDelete = () => {
    onDelete(event.id);
  };

  const handleBookNext = () => {
    onBookNext(event);
  };

  const handleMarkUnpaid = () => {
    onMarkPayment(event, 'unpaid');
  };

  const handleMarkPaid = () => {
    onMarkPayment(event, 'paid');
  };

  const handleMarkNoShow = () => {
    onMarkLessonStatus(event, 'no-show');
  };

  const handleMarkCancelled = () => {
    onMarkLessonStatus(event, 'cancelled');
  };

  const handleMarkScheduled = () => {
    onMarkLessonStatus(event, 'scheduled');
  };

  const handleSendWhatsApp = () => {
    if (onSendWhatsApp) {
      onSendWhatsApp(event);
    }
  };
  
  const handleAddToBill = () => {
    if (event && event.studentId && event.services && event.services.length > 0) {
      onOpenChange(false);
      setTimeout(() => {
        router.push(`/payments?studentId=${event.studentId}&eventIds=${encodeURIComponent(event.id)}`);
      }, 150);
    }
  };

  const isBlockedSlot = event.studentId === null;
  const canAddToBill = !isBlockedSlot && event.services && event.services.length > 0;
  const paymentLabel = event.paymentStatus === 'paid' ? 'Paid' : event.paymentStatus === 'unpaid' ? 'Unpaid' : 'Not marked';
  const lessonStatus = event.lessonStatus || 'scheduled';
  const lessonStatusLabel = lessonStatus === 'no-show' ? 'No Show' : lessonStatus === 'cancelled' ? 'Cancelled' : 'Scheduled';
  
  const wazeUrl = event.studentAddress ? `https://waze.com/ul?q=${encodeURIComponent(event.studentAddress)}&navigate=yes` : null;

  const colorName = getServiceColorName(event.services?.[0]?.id);

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{isBlockedSlot ? 'Blocked Time' : event.studentName}</DialogTitle>
          <DialogDescription>
            {format(new Date(event.start), 'eeee, MMMM d, yyyy')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <InfoItem icon={Clock}>
            {format(new Date(event.start), 'h:mm a')} - {format(new Date(event.end), 'h:mm a')}
          </InfoItem>

          {!isBlockedSlot && (
            <>
                {event.studentName && <InfoItem icon={User}>{event.studentName}</InfoItem>}
                {event.services && event.services.length > 0 && (
                  <InfoItem icon={Package}>
                      <ul className="space-y-2">
                        {event.services.map(service => (
                          <li key={service.id} className="flex items-center gap-2">
                            <span className={cn("h-3 w-3 rounded-full", {
                              'bg-chart-1': getServiceColorName(service.id) === 'chart-1',
                              'bg-chart-2': getServiceColorName(service.id) === 'chart-2',
                              'bg-chart-3': getServiceColorName(service.id) === 'chart-3',
                              'bg-chart-4': getServiceColorName(service.id) === 'chart-4',
                              'bg-chart-5': getServiceColorName(service.id) === 'chart-5',
                            })}></span>
                            <span>{service.name}</span>
                          </li>
                        ))}
                      </ul>
                  </InfoItem>
                )}
                {event.studentAddress && wazeUrl && (
                    <InfoItem icon={Navigation} isLink>
                        <div className="space-y-2">
                          <p className="text-sm font-medium leading-snug text-foreground">
                            {event.studentAddress}
                          </p>
                          <Link
                            href={wazeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-10 items-center gap-2 rounded-full bg-sky-600 px-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-700"
                            aria-label={`Open ${event.studentAddress} in Waze`}
                            title="Open pickup in Waze"
                          >
                            <Navigation className="h-4 w-4" />
                            Open in Waze
                          </Link>
                        </div>
                    </InfoItem>
                )}
                {event.examCenter && (
                  <InfoItem icon={Navigation}>{event.examCenter}</InfoItem>
                )}
            </>
          )}

          {event.notes && <InfoItem icon={Info}>{event.notes}</InfoItem>}

          {event.examImageDataUri && (
            <InfoItem icon={ImageIcon}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsExamImageOpen(true)}
                className="gap-2"
              >
                <ImageIcon className="h-4 w-4" />
                Exam confirmation
              </Button>
            </InfoItem>
          )}

          {!isBlockedSlot && (
            <InfoItem icon={Receipt}>
              <div className="flex flex-wrap items-center gap-2">
                <span>Payment:</span>
                <span className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-semibold",
                  event.paymentStatus === 'paid'
                    ? 'bg-emerald-100 text-emerald-700'
                    : event.paymentStatus === 'unpaid'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-muted text-muted-foreground'
                )}>
                  {paymentLabel}
                </span>
              </div>
            </InfoItem>
          )}

          {!isBlockedSlot && (
            <InfoItem icon={CalendarCheck2}>
              <div className="flex flex-wrap items-center gap-2">
                <span>Lesson:</span>
                <span className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-semibold",
                  lessonStatus === 'scheduled'
                    ? 'bg-emerald-100 text-emerald-700'
                    : lessonStatus === 'no-show'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-200 text-slate-700'
                )}>
                  {lessonStatusLabel}
                </span>
              </div>
            </InfoItem>
          )}

        </div>

        {!isBlockedSlot && (
          <div className="grid grid-cols-3 gap-1.5 border-t pt-3 sm:gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleBookNext} className="h-9 px-2 text-xs sm:h-10 sm:text-sm">
              <CalendarPlus className="mr-1 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
              Book Next
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleMarkUnpaid}
              disabled={!canAddToBill}
              className={cn(
                "h-9 px-2 text-xs sm:h-10 sm:text-sm",
                event.paymentStatus === 'unpaid' && "border-amber-400 bg-amber-100 text-amber-800 hover:bg-amber-100"
              )}
            >
              <Receipt className="mr-1 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
              Mark Unpaid
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleMarkPaid}
              disabled={!canAddToBill}
              className={cn(
                "h-9 px-2 text-xs sm:h-10 sm:text-sm",
                event.paymentStatus === 'paid' && "bg-emerald-600 text-white hover:bg-emerald-700"
              )}
            >
              <CheckCircle2 className="mr-1 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
              {event.paymentStatus === 'paid' ? 'Paid' : 'Cash Paid'}
            </Button>
          </div>
        )}

        {!isBlockedSlot && (
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleMarkNoShow}
              className={cn(
                "h-9 px-2 text-xs sm:h-10 sm:text-sm",
                lessonStatus === 'no-show' && "border-amber-400 bg-amber-100 text-amber-800 hover:bg-amber-100"
              )}
            >
              <UserX className="mr-1 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
              No Show
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleMarkCancelled}
              className={cn(
                "h-9 px-2 text-xs sm:h-10 sm:text-sm",
                lessonStatus === 'cancelled' && "border-slate-400 bg-slate-200 text-slate-800 hover:bg-slate-200"
              )}
            >
              <XCircle className="mr-1 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSendWhatsApp}
              className="h-9 px-2 text-xs sm:h-10 sm:text-sm border-emerald-400 bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
            >
              <MessageCircle className="mr-1 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
              WhatsApp
            </Button>
          </div>
        )}

        <DialogFooter className="flex-row justify-between items-center sm:justify-between pt-2">
          <div className="flex items-center gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" type="button" size="icon">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete this event.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            {canAddToBill && (
              <Button variant="outline" size="icon" onClick={handleAddToBill}>
                <Receipt className="h-4 w-4" />
                <span className="sr-only">Add to Bill</span>
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button type="button" onClick={handleEdit}>
              <Edit className="mr-2 h-4 w-4" /> Edit
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    {event.examImageDataUri && (
      <Dialog open={isExamImageOpen} onOpenChange={setIsExamImageOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Exam Confirmation</DialogTitle>
            <DialogDescription>
              Saved image for this scheduled exam.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[75vh] overflow-auto rounded-lg border bg-muted/20 p-2">
            <img
              src={event.examImageDataUri}
              alt="Exam confirmation"
              className="h-auto w-full rounded-md object-contain"
            />
          </div>
        </DialogContent>
      </Dialog>
    )}
    </>
  );
}


const InfoItem = ({ icon: Icon, isLink = false, children }: { icon: React.ElementType, isLink?: boolean, children: React.ReactNode }) => (
    <div className="flex items-start gap-3">
      <Icon className="h-5 w-5 text-muted-foreground mt-1 flex-shrink-0" />
      <div className={cn("text-sm", isLink ? '' : 'text-foreground')}>
        {children}
      </div>
    </div>
  );
