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
import { CalendarPlus, CheckCircle2, Edit, Trash2, Navigation, Clock, Image as ImageIcon, Info, User, Package, Receipt, UserX, XCircle, MessageCircle, ClipboardCheck, CalendarDays, MapPin, CarFront } from 'lucide-react';
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
  instructorName?: string;
  onEdit: (event: CalendarEvent) => void;
  onDelete: (eventId: string) => void;
  onBookNext: (event: CalendarEvent) => void;
  onMarkPayment: (event: CalendarEvent, status: 'paid' | 'unpaid') => void;
  onMarkLessonStatus: (event: CalendarEvent, status: LessonStatus) => void;
  onSendWhatsApp?: (event: CalendarEvent) => void;
  onEvaluate: (event: CalendarEvent) => void;
}

export function EventDetailsDialog({
  isOpen,
  onOpenChange,
  event,
  instructorName,
  onEdit,
  onDelete,
  onBookNext,
  onMarkPayment,
  onMarkLessonStatus,
  onSendWhatsApp,
  onEvaluate,
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
        router.push(`/app/payments?studentId=${event.studentId}&eventIds=${encodeURIComponent(event.id)}`);
      }, 150);
    }
  };

  const isBlockedSlot = event.studentId === null;
  const canAddToBill = !isBlockedSlot && event.services && event.services.length > 0;
  const lessonStatus = event.lessonStatus || 'scheduled';
  const isExamEvent = Boolean(event.examCenter || event.examDateTime || event.examImageDataUri || event.title?.toLowerCase().includes('exam'));
  const eventLabel = isExamEvent ? 'Road test' : event.services?.[0]?.name || 'Driving lesson';
  const paymentLabel = event.paymentStatus === 'paid' ? 'Cash Paid' : event.paymentStatus === 'unpaid' ? 'Unpaid' : 'Payment pending';
  
  const wazeUrl = event.studentAddress ? `https://waze.com/ul?q=${encodeURIComponent(event.studentAddress)}&navigate=yes` : null;

  const colorName = getServiceColorName(event.services?.[0]?.id);

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-md overflow-y-auto rounded-t-[28px] p-0 sm:rounded-2xl">
        <div className="px-4 pb-4 pt-3 sm:px-6 sm:pb-6">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-muted sm:hidden" />
          <DialogHeader className="text-left">
            <div className="flex items-start gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e8eefc] text-xl font-bold text-[#3157b7]">
                {event.studentId && event.studentName ? event.studentName.charAt(0).toUpperCase() : <CarFront className="h-6 w-6" />}
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="truncate text-xl sm:text-2xl">{isBlockedSlot ? 'Blocked time' : event.studentName}</DialogTitle>
                <DialogDescription className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border bg-muted/40 px-2.5 py-1 text-xs font-semibold text-foreground">{eventLabel}</span>
                  {instructorName && <span className="text-xs text-muted-foreground">{instructorName}</span>}
                </DialogDescription>
              </div>
              {!isBlockedSlot && <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold', event.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800')}>{paymentLabel}</span>}
            </div>
          </DialogHeader>

          <div className="mt-5 grid grid-cols-2 divide-x rounded-2xl border bg-card p-3 shadow-sm">
            <div className="flex items-center gap-2 px-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              <div><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Date</p><p className="text-sm font-semibold">{format(new Date(event.start), 'EEE, MMM d, yyyy')}</p></div>
            </div>
            <div className="flex items-center gap-2 px-2">
              <Clock className="h-5 w-5 text-primary" />
              <div><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Time</p><p className="text-sm font-semibold">{format(new Date(event.start), 'h:mm a')} - {format(new Date(event.end), 'h:mm a')}</p></div>
            </div>
          </div>

          {!isBlockedSlot && (
            <div className="mt-4 space-y-3">
              {isExamEvent ? (
                <div className="rounded-2xl border bg-[#f7f5ff] p-4">
                  <div className="mb-2 flex items-center gap-2 font-semibold"><MapPin className="h-5 w-5 text-indigo-600" /> Exam details</div>
                  <p className="text-sm font-medium">{event.examCenter || 'Exam centre not added'}</p>
                  {event.examDateTime && <p className="mt-1 text-sm text-muted-foreground">Exam time: {format(new Date(event.examDateTime), 'EEE, MMM d, yyyy · h:mm a')}</p>}
                </div>
              ) : (
                <div className="rounded-2xl border bg-[#f7fbff] p-4">
                  <div className="mb-2 flex items-center gap-2 font-semibold"><MapPin className="h-5 w-5 text-sky-600" /> Pickup address</div>
                  <p className="text-sm font-medium">{event.studentAddress || 'No pickup address added'}</p>
                  {wazeUrl && <Link href={wazeUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white hover:bg-sky-700"><Navigation className="h-4 w-4" /> Open in Waze</Link>}
                </div>
              )}
              {event.services && event.services.length > 0 && !isExamEvent && (
                <div className="rounded-2xl border p-4"><div className="mb-2 flex items-center gap-2 font-semibold"><Package className="h-5 w-5 text-primary" /> Services</div><p className="text-sm text-muted-foreground">{event.services.map(service => service.name).join(' · ')}</p></div>
              )}
              {event.notes && <div className="rounded-2xl border p-4"><div className="mb-2 flex items-center gap-2 font-semibold"><Info className="h-5 w-5 text-muted-foreground" /> Notes</div><p className="whitespace-pre-wrap text-sm text-muted-foreground">{event.notes}</p></div>}
              {event.examImageDataUri && <Button type="button" variant="outline" onClick={() => setIsExamImageOpen(true)} className="h-11 w-full justify-start gap-2 rounded-xl"><ImageIcon className="h-4 w-4" /> View exam confirmation</Button>}
            </div>
          )}

          <div className="mt-4">

        {!isBlockedSlot && (
          <div className="grid grid-cols-3 gap-2 border-t pt-4">
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
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onEvaluate(event)} className="h-9 border-[#d4af37] bg-[#fff9e7] px-2 text-xs font-bold text-[#806000] hover:bg-[#fff1bd] sm:h-10 sm:text-sm">
              <ClipboardCheck className="mr-1 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />Evaluate
            </Button>
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
              className="col-span-2 h-10 border-emerald-400 bg-emerald-100 px-2 text-xs text-emerald-800 hover:bg-emerald-100 sm:text-sm"
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
          </div>
        </div>
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
