'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CalendarEvent } from '@/lib/types';
import { useStudents } from '@/hooks/use-students';
import { useServices } from '@/hooks/use-services';
import { format, setHours, setMinutes, parse, addMinutes } from 'date-fns';
import { Trash2, Plus, Loader2 } from 'lucide-react';
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
  } from "@/components/ui/alert-dialog"
import { useRouter } from 'next/navigation';

const eventSchema = z.object({
  studentId: z.string().nullable(),
  date: z.string(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:mm).'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:mm).'),
  services: z.array(z.object({
    id: z.string(),
    name: z.string(),
    price: z.number().optional(),
    cost: z.number().optional(),
    discount: z.number().optional(),
  })).optional(),
  notes: z.string().optional(),
  sendSms: z.boolean().default(false),
}).refine(data => {
    const start = parse(data.startTime, 'HH:mm', new Date());
    const end = parse(data.endTime, 'HH:mm', new Date());
    return end > start;
}, {
  message: 'End time must be after start time.',
  path: ['endTime'],
});

type EventFormData = z.infer<typeof eventSchema>;

interface EventDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  event: CalendarEvent | null;
  selectedDate: Date | null;
  onSave: (eventData: Omit<CalendarEvent, 'id'> | CalendarEvent, sendSms: boolean) => Promise<void> | void;
  onDelete: (eventId: string) => void;
}

export function EventDialog({
  isOpen,
  onOpenChange,
  event,
  selectedDate,
  onSave,
  onDelete,
}: EventDialogProps) {
  const { students, updateStudent } = useStudents();
  const { services: allServices } = useServices();
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  const sortedStudents = useMemo(() => {
    if (!students) return [];
    // Display active and booked students, sorted by name
    return [...students]
      .filter(s => s.status === 'active' || s.status === 'booked')
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [students]);

  const form = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      studentId: null,
      services: [],
      sendSms: false,
    }
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "services"
  });
  
  const watchedServices = useWatch({ control: form.control, name: 'services' });
  const watchedStartTime = useWatch({ control: form.control, name: 'startTime' });
  const watchedDate = useWatch({ control: form.control, name: 'date' });
  const watchedStudentId = useWatch({ control: form.control, name: 'studentId' });
  const [missingAddress, setMissingAddress] = useState('');
  const [serviceWarning, setServiceWarning] = useState('');

  const selectedStudentForAddress = useMemo(() => {
    if (!students || !watchedStudentId || watchedStudentId === 'none') return null;
    return students.find(s => s.id === watchedStudentId) || null;
  }, [students, watchedStudentId]);

  const needsStudentAddress = Boolean(selectedStudentForAddress && !selectedStudentForAddress.address?.trim());
  const needsStudentPhone = Boolean(selectedStudentForAddress && !selectedStudentForAddress.mobileNumber?.trim());

  useEffect(() => {
    if (!isOpen) return;

    const dateToUse = event ? new Date(event.start) : selectedDate;
    if (dateToUse) {
      let startTimeStr = '';
      if (event) {
        startTimeStr = format(dateToUse, 'HH:mm');
      } else {
        const h = dateToUse.getHours();
        const m = dateToUse.getMinutes();
        if (h === 0 && m === 0) {
          startTimeStr = '09:00'; // Default to 9 AM if midnight (calendar click)
        } else {
          let nextM = m > 0 && m <= 30 ? 30 : 0;
          let nextH = m > 30 ? h + 1 : h;
          if (nextH < 9) { nextH = 9; nextM = 0; }
          if (nextH >= 19) { nextH = 9; nextM = 0; }
          startTimeStr = `${nextH.toString().padStart(2, '0')}:${nextM.toString().padStart(2, '0')}`;
        }
      }

      const initialStartDateTime = parse(`${format(dateToUse, 'yyyy-MM-dd')} ${startTimeStr}`, 'yyyy-MM-dd HH:mm', new Date());

      form.reset({
        studentId: event?.studentId ?? null,
        date: format(dateToUse, 'yyyy-MM-dd'),
        startTime: startTimeStr,
        endTime: event ? format(new Date(event.end), 'HH:mm') : format(addMinutes(initialStartDateTime, 60), 'HH:mm'),
        services: event?.services ?? [],
        notes: event?.notes ?? '',
        sendSms: false,
      });
      setMissingAddress('');
      setServiceWarning('');
    }
  }, [event, selectedDate, isOpen, form]);

  useEffect(() => {
      if (!allServices || !watchedServices || !watchedDate || !watchedStartTime) return;

      const totalDuration = watchedServices.reduce((acc, currentService) => {
          const serviceDetails = allServices.find(s => s.id === currentService.id);
          return acc + (serviceDetails?.duration || 0);
      }, 0);
      
      // If no services, default to a 60 min block, but don't override if user sets end time manually
      const effectiveDuration = totalDuration > 0 ? totalDuration : 60;

      try {
        const startDateTime = parse(`${watchedDate} ${watchedStartTime}`, 'yyyy-MM-dd HH:mm', new Date());
        if (!isNaN(startDateTime.getTime())) {
          const endDateTime = addMinutes(startDateTime, effectiveDuration);
          form.setValue('endTime', format(endDateTime, 'HH:mm'), { shouldValidate: true });
        }
      } catch (e) {
        console.error("Error parsing date/time:", e);
      }
  }, [allServices, watchedServices, watchedDate, watchedStartTime, form]);


  const onSubmit = async (data: EventFormData) => {
    setIsSaving(true);
    try {
        const finalStartDate = parse(`${data.date} ${data.startTime}`, 'yyyy-MM-dd HH:mm', new Date());
        const finalEndDate = parse(`${data.date} ${data.endTime}`, 'yyyy-MM-dd HH:mm', new Date());

        const finalStudentId = data.studentId === 'none' ? null : data.studentId;

        const selectedStudent = students?.find(s => s.id === finalStudentId);
        const addressToUse = selectedStudent?.address?.trim() || missingAddress.trim();
        const selectedServices = data.services?.filter(service => service.id && service.id !== 'none') ?? [];

        if (finalStudentId && selectedServices.length === 0) {
          setServiceWarning(
            allServices.length > 0
              ? 'Please select a service before scheduling this student.'
              : 'Please add a service in Settings > Services before scheduling this student.'
          );
          return;
        }

        if (selectedStudent && !addressToUse) {
          form.setError('studentId', {
            type: 'manual',
            message: 'This student has no address. Please add an address before scheduling.',
          });
          return;
        }

        if (selectedStudent && !selectedStudent.address?.trim() && addressToUse) {
          await updateStudent({ id: selectedStudent.id, address: addressToUse });
        }

        const eventData = {
          title: selectedStudent ? selectedStudent.name : 'Blocked',
          start: finalStartDate.toISOString(),
          end: finalEndDate.toISOString(),
          studentId: finalStudentId,
          studentName: selectedStudent?.name ?? 'N/A',
          studentAddress: addressToUse || undefined,
          services: selectedServices.map(service => {
              const serviceDetails = allServices.find(item => item.id === service.id || item.name === service.name);
              return {
                id: service.id,
                name: service.name,
                price: serviceDetails?.price ?? service.price,
                cost: serviceDetails?.cost ?? service.cost ?? 0,
                discount: serviceDetails?.discount ?? service.discount ?? 0,
              };
            }),
          notes: data.notes,
        };

        if (event) {
          await onSave({ ...event, ...eventData }, data.sendSms);
        } else {
          await onSave(eventData, data.sendSms);
        }
    } finally {
        setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (event) {
      onDelete(event.id);
    }
  }

  const handleAddNewStudent = () => {
    onOpenChange(false);
    setTimeout(() => {
      router.push('/students/form');
    }, 150);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{event ? 'Edit Event' : 'Add Event'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="studentId"
              render={({ field }) => (
                <FormItem>
                  <div className="flex justify-between items-center">
                    <FormLabel>Student</FormLabel>
                    <Button type="button" variant="link" size="sm" className="p-0 h-auto" onClick={handleAddNewStudent}>
                        <Plus className="h-4 w-4 mr-1" />
                        New Student
                    </Button>
                  </div>
                  <Select onValueChange={field.onChange} value={field.value ?? 'none'}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a student" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">None (Block time)</SelectItem>
                      {sortedStudents.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {needsStudentAddress && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-950">
                <FormLabel htmlFor="missing-student-address" className="text-sm font-semibold flex items-center gap-2">
                  Student Address Required
                </FormLabel>
                <Input
                  id="missing-student-address"
                  value={missingAddress}
                  onChange={(event) => setMissingAddress(event.target.value)}
                  placeholder="Enter pickup address before scheduling"
                  className="mt-2 bg-white"
                />
                <p className="mt-2 text-xs text-amber-800">
                  This student profile has no address. The address you enter here will be saved to the profile and used for this schedule.
                </p>
              </div>
            )}

            {needsStudentPhone && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-950 flex gap-2">
                <p className="text-sm">
                  <strong>Missing Phone Number:</strong> This student has no phone number on file. SMS notifications will not be sent. You can update this in their profile.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem className="md:col-span-3">
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="startTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>From</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} step="1800" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>To</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} step="1800" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>

            <FormItem>
              <FormLabel>Services</FormLabel>
              <div className="space-y-2">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex items-center gap-2">
                    <FormField
                      control={form.control}
                      name={`services.${index}`}
                      render={({ field: selectField }) => (
                        <Select
                          onValueChange={(value) => {
                            const selectedService = allServices.find(s => s.id === value);
                            if (selectedService) {
                              setServiceWarning('');
                              selectField.onChange({
                                id: selectedService.id,
                                name: selectedService.name,
                                price: selectedService.price,
                                cost: selectedService.cost || 0,
                                discount: selectedService.discount || 0,
                              });
                            }
                          }}
                          value={selectField.value?.id}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a service" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {allServices.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => {
                      remove(index);
                      setServiceWarning('');
                    }}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
              {serviceWarning && (
                <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {serviceWarning}
                </p>
              )}
              {allServices.length === 0 && (
                <div className="mt-2 flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
                  <span>Add a service first before scheduling students.</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onOpenChange(false);
                      router.push('/settings?tab=services');
                    }}
                  >
                    Add Service
                  </Button>
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => {
                  setServiceWarning('');
                  if (allServices.length === 0) {
                    onOpenChange(false);
                    router.push('/settings?tab=services');
                    return;
                  }
                  append({ id: '', name: '', price: 0, cost: 0, discount: 0 });
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Service
              </Button>
            </FormItem>


            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Any details about the appointment..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sendSms"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm bg-blue-50/50 dark:bg-blue-900/10">
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                      className="h-4 w-4 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Send SMS Notification</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Automatically text the student their appointment details.
                    </p>
                  </div>
                </FormItem>
              )}
            />

            <DialogFooter className="flex-row justify-between items-center sm:justify-between pt-4">
                <div>
                 {event && (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" type="button" size="icon">
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                            <DialogTitle>Are you sure?</DialogTitle>
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
                 )}
                </div>

                <div className="flex gap-2">
                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isSaving}>
                        {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        {isSaving ? "Saving..." : "Save Event"}
                    </Button>
                </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
