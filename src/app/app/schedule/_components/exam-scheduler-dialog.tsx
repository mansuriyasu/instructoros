'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Car, MapPin, Upload, Plus } from 'lucide-react';
import { useStudents } from '@/hooks/use-students';
import { CalendarEvent, InstructorOption } from '@/lib/types';
import { compressImage } from '@/lib/image-utils';
import { useToast } from '@/hooks/use-toast';
import { useServices } from '@/hooks/use-services';

const CUSTOM_EXAM_CENTER_VALUE = '__custom_exam_center__';

interface ExamSchedulerDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (event: Omit<CalendarEvent, 'id'>, sendSms?: boolean) => Promise<void> | void;
  initialStudentId?: string;
  instructors?: InstructorOption[];
  canManageInstructorSchedules?: boolean;
}

export function ExamSchedulerDialog({
  isOpen,
  onOpenChange,
  onSave,
  initialStudentId,
  instructors = [],
  canManageInstructorSchedules = false,
}: ExamSchedulerDialogProps) {
  const { students, addStudent, updateStudent } = useStudents();
  const { services } = useServices();
  const { toast } = useToast();

  const isExamCenterService = (category?: string) => {
    const normalized = (category || '').trim().toLowerCase();
    return normalized === 'exam center' || normalized === 'exam centre';
  };

  const sortedStudents = useMemo(() => {
    return [...(students || [])].sort((a, b) => a.name.localeCompare(b.name));
  }, [students]);

  const examCenterServices = useMemo(() => {
    return [...(services || [])]
      .filter(service => isExamCenterService(service.category))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [services]);

  const billableServices = useMemo(() => {
    return [...(services || [])]
      .filter(service => !isExamCenterService(service.category))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [services]);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Extracted Data
  const [examDate, setExamDate] = useState('');
  const [examTime, setExamTime] = useState('');
  const [examCenter, setExamCenter] = useState('');
  const [studentName, setStudentName] = useState('');
  const [examImageDataUri, setExamImageDataUri] = useState('');
  
  // Match or Creation
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedInstructorId, setSelectedInstructorId] = useState('');
  const [newStudentAddress, setNewStudentAddress] = useState('');
  const [isCreatingStudent, setIsCreatingStudent] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedExamCenterServiceId, setSelectedExamCenterServiceId] = useState('');

  // Time calculations
  const [travelMins, setTravelMins] = useState<number>(30); // Default 30 mins
  const [lessonMins, setLessonMins] = useState<number>(50); // Default 50 mins
  const [earlyMins, setEarlyMins] = useState<number>(30); // Default 30 mins early arrival
  const [examMins, setExamMins] = useState<number>(30); // Default 30 mins
  const [sendSms, setSendSms] = useState(false);

  const selectedExamCenterService = useMemo(() => {
    return examCenterServices.find(service => service.id === selectedExamCenterServiceId) || null;
  }, [examCenterServices, selectedExamCenterServiceId]);

  const selectedBillableService = useMemo(() => {
    return billableServices.find(service => service.id === selectedServiceId) || null;
  }, [billableServices, selectedServiceId]);

  useEffect(() => {
    if (!isOpen || !canManageInstructorSchedules || selectedInstructorId || instructors.length === 0) return;
    setSelectedInstructorId(instructors[0].uid);
  }, [canManageInstructorSchedules, instructors, isOpen, selectedInstructorId]);

  const resolvedExamCenter = selectedExamCenterService?.name || examCenter.trim();

  const showServiceRequiredToast = () => {
    toast({
      title: 'Service required',
      description: billableServices.length > 0
        ? 'Please select a service before scheduling this exam.'
        : 'Please add a service in Settings > Services before scheduling exams.',
      variant: 'destructive',
    });
  };

  const findExamCenterService = (centerName: string) => {
    const normalizedCenter = centerName.trim().toLowerCase();
    if (!normalizedCenter) return null;

    return examCenterServices.find(service => {
      const normalizedServiceName = service.name.trim().toLowerCase();
      return normalizedServiceName === normalizedCenter
        || normalizedServiceName.includes(normalizedCenter)
        || normalizedCenter.includes(normalizedServiceName);
    }) || null;
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIsProcessing(true);
      try {
        const base64 = await compressImage(e.target.files[0], 1200, 0.7);
        const savedImage = await compressImage(e.target.files[0], 700, 0.45);
        setExamImageDataUri(savedImage);
        
        const res = await fetch('/api/exam-scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photoDataUri: base64 }),
        });
        const result = await res.json();
        
        if (!result.ok) throw new Error(result.error);
        
        setStudentName(result.details.studentName || '');
        const extractedCenter = result.details.examCenter || '';
        const matchedExamCenter = findExamCenterService(extractedCenter);
        setSelectedExamCenterServiceId(matchedExamCenter?.id || (extractedCenter ? CUSTOM_EXAM_CENTER_VALUE : ''));
        setExamCenter(matchedExamCenter?.name || extractedCenter);
        setExamDate(result.details.examDate || '');
        setExamTime(result.details.examTime || '');
        
        const examServiceMatch = billableServices?.find(service => {
          const name = service.name.toLowerCase();
          return name.includes('exam') || name.includes('road test') || name.includes('test');
        });
        if (examServiceMatch) setSelectedServiceId(examServiceMatch.id);
        
        if (initialStudentId) {
            const initialStudent = students?.find(s => s.id === initialStudentId);
            setSelectedStudentId(initialStudentId);
            setStudentName(initialStudent?.name || result.details.studentName || '');
            setIsCreatingStudent(false);
        } else if (result.details.studentName) {
            const match = students?.find(s => s.name.toLowerCase() === result.details.studentName.toLowerCase());
            if (match) setSelectedStudentId(match.id);
            else setIsCreatingStudent(true);
        }

        setStep(2);
      } catch (error) {
        toast({ title: 'Extraction Failed', description: String(error), variant: 'destructive' });
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleCalculateTimes = async () => {
    setIsProcessing(true);
    try {
        let finalStudentId = selectedStudentId;
        let originAddress = '';
        const finalExamCenter = resolvedExamCenter;

        if (!selectedBillableService) {
            showServiceRequiredToast();
            setIsProcessing(false);
            return;
        }

        if (!finalExamCenter) {
            toast({ title: "Validation Error", description: "Please select an exam center location." });
            setIsProcessing(false);
            return;
        }

        if (isCreatingStudent) {
            if (!studentName || !newStudentAddress) {
                toast({ title: "Validation Error", description: "Name and Address are required to create a student." });
                setIsProcessing(false);
                return;
            }
            const docRef = await addStudent({ name: studentName, address: newStudentAddress } as any);
            finalStudentId = docRef?.id || '';
            originAddress = newStudentAddress;
            setSelectedStudentId(finalStudentId);
            setIsCreatingStudent(false);
        } else {
            const student = students?.find(s => s.id === finalStudentId);
            if (!student) {
                toast({ title: "Validation Error", description: "Please select a student." });
                setIsProcessing(false);
                return;
            }
            originAddress = student.address;
        }

        // Call AI travel time estimation
        if (originAddress && finalExamCenter) {
            const res = await fetch('/api/travel-time', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ origin: originAddress, destination: finalExamCenter }),
            });
            const result = await res.json();
            if (result.ok && result.details?.travelTimeMinutes) {
                setTravelMins(result.details.travelTimeMinutes);
            }
        }
        
        setStep(3);
    } catch(err) {
        toast({ title: 'Error calculating times', description: String(err), variant: 'destructive' });
    } finally {
        setIsProcessing(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      handleReset();
      return;
    }

    if (initialStudentId) {
      const initialStudent = students?.find(s => s.id === initialStudentId);
      setSelectedStudentId(initialStudentId);
      if (initialStudent?.name) setStudentName(initialStudent.name);
      setIsCreatingStudent(false);
    }
    onOpenChange(open);
  };

  const handleSave = async () => {
    setIsProcessing(true);
    try {
        // Parse the exact exam time
        // examDate = YYYY-MM-DD
        // examTime = HH:MM (maybe AM/PM)
        // Let's create a generic date and try to parse it
        const baseDateString = `${examDate} ${examTime}`;
        let examDateTime = new Date(baseDateString);
        if (isNaN(examDateTime.getTime())) {
             // Fallback if parsing fails (e.g. 02:30 PM format issues in some browsers)
             examDateTime = new Date(`${examDate}T12:00:00`);
        }

        const examStartTimeMs = examDateTime.getTime();
        
        // Calculate Total Block
        // Pickup (Start) = Exam Time - Early Mins - Lesson Mins - Travel Mins
        const pickupMs = examStartTimeMs - (earlyMins * 60000) - (lessonMins * 60000) - (travelMins * 60000);
        const start = new Date(pickupMs);
        
        // Dropoff (End) = Exam Time + Exam Mins + Travel Mins
        const dropoffMs = examStartTimeMs + (examMins * 60000) + (travelMins * 60000);
        const end = new Date(dropoffMs);

        const student = students?.find(s => s.id === selectedStudentId);
        const finalExamCenter = resolvedExamCenter;

        if (!finalExamCenter) {
            toast({ title: "Validation Error", description: "Please select an exam center location." });
            setIsProcessing(false);
            return;
        }
        
        const examService = selectedBillableService;
        if (!examService) {
            showServiceRequiredToast();
            setIsProcessing(false);
            return;
        }

        if (canManageInstructorSchedules && instructors.length > 0 && !selectedInstructorId) {
            toast({ title: "Validation Error", description: "Please select the instructor for this exam schedule." });
            setIsProcessing(false);
            return;
        }

        await onSave({
            title: `Exam: ${student?.name || studentName} @ ${finalExamCenter}`,
            start: start.toISOString(),
            end: end.toISOString(),
            instructorId: selectedInstructorId || null,
            studentId: selectedStudentId || null,
            studentName: student?.name || studentName || 'N/A',
            services: [{
                id: examService.id,
                name: examService.name,
                price: examService.price,
                cost: examService.cost || 0,
                discount: examService.discount || 0,
            }],
            notes: `Pickup at ${student?.address || newStudentAddress}.\nTravel (${travelMins}m) -> Lesson (${lessonMins}m) -> Early Arrival (${earlyMins}m) -> Exam at ${examTime} (${examMins}m) -> Travel back (${travelMins}m).`,
            lessonStatus: 'scheduled',
            examCenter: finalExamCenter,
            examDateTime: examDateTime.toISOString(),
            examImageDataUri,
        }, sendSms);

        if (selectedStudentId) {
            // Update the student's status to 'booked' since they now have an exam scheduled
            await updateStudent({ id: selectedStudentId, status: 'booked' });
        }

        toast({ title: "Success", description: "Exam scheduled successfully!" });
        handleReset();
    } catch(err) {
        toast({ title: 'Error saving exam', description: String(err), variant: 'destructive' });
    } finally {
        setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setExamDate('');
    setExamTime('');
    setExamCenter('');
    setStudentName('');
    setExamImageDataUri('');
    setSelectedStudentId('');
    setSelectedInstructorId('');
    setSelectedServiceId('');
    setSelectedExamCenterServiceId('');
    setNewStudentAddress('');
    setIsCreatingStudent(false);
    setTravelMins(30);
    setEarlyMins(30);
    setSendSms(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule an Exam</DialogTitle>
          <DialogDescription>
             Use AI to scan an exam confirmation and calculate travel + lesson times.
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="flex flex-col items-center justify-center py-8 gap-4 border-2 border-dashed rounded-lg border-muted-foreground/25 hover:border-primary/50 transition-colors">
            <div className="bg-primary/10 p-4 rounded-full">
              <Upload className="w-8 h-8 text-primary" />
            </div>
            <p className="text-sm text-center text-muted-foreground px-4">
              Upload a screenshot or photo of the DriveTest booking confirmation.
            </p>
            <div className="relative mt-2">
              <Input type="file" accept="image/*" onChange={handleImageUpload} disabled={isProcessing} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              <Button disabled={isProcessing} variant="secondary">
                 {isProcessing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Scanning...</> : 'Select Image'}
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 py-4">
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Exam Date</Label>
                    <Input value={examDate} onChange={e => setExamDate(e.target.value)} type="date" />
                </div>
                <div className="space-y-2">
                    <Label>Exam Time</Label>
                    <Input value={examTime} onChange={e => setExamTime(e.target.value)} type="time" />
                </div>
                <div className="col-span-2 space-y-2">
                    <Label>Exam Center / Location</Label>
                    {examCenterServices.length > 0 ? (
                        <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={selectedExamCenterServiceId}
                            onChange={e => {
                                const value = e.target.value;
                                setSelectedExamCenterServiceId(value);
                                const selectedCenter = examCenterServices.find(service => service.id === value);
                                if (selectedCenter) {
                                    setExamCenter(selectedCenter.name);
                                }
                            }}
                        >
                            <option value="">Select an exam center...</option>
                            {examCenterServices.map(center => (
                                <option key={center.id} value={center.id}>{center.name}</option>
                            ))}
                            <option value={CUSTOM_EXAM_CENTER_VALUE}>Use scanned/custom location</option>
                        </select>
                    ) : (
                        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                            Add exam center locations in Settings &gt; Services using the category "Exam center".
                        </p>
                    )}
                    {(selectedExamCenterServiceId === CUSTOM_EXAM_CENTER_VALUE || examCenterServices.length === 0) && (
                        <Input
                            value={examCenter}
                            onChange={e => {
                                setSelectedExamCenterServiceId(examCenterServices.length > 0 ? CUSTOM_EXAM_CENTER_VALUE : '');
                                setExamCenter(e.target.value);
                            }}
                            placeholder="DriveTest center address or name"
                        />
                    )}
                    {selectedExamCenterService && (
                        <p className="text-xs text-muted-foreground mt-1">
                            Selected saved exam center: <span className="font-semibold">{selectedExamCenterService.name}</span>
                        </p>
                    )}
                    {!selectedExamCenterService && examCenter && (
                        <p className="text-xs text-muted-foreground mt-1">
                            Scanned/custom location: <span className="font-semibold">{examCenter}</span>.
                        </p>
                    )}
                </div>
                <div className="col-span-2 space-y-2">
                    <Label>Service</Label>
                    {billableServices.length === 0 && (
                        <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                            Add a service in Settings &gt; Services before scheduling exams.
                        </p>
                    )}
                    <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={selectedServiceId}
                        onChange={e => {
                            setSelectedServiceId(e.target.value);
                        }}
                    >
                        <option value="">Select a service...</option>
                        {billableServices.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                </div>
                {canManageInstructorSchedules && instructors.length > 0 && (
                    <div className="col-span-2 space-y-2">
                        <Label>Instructor</Label>
                        <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={selectedInstructorId}
                            onChange={e => setSelectedInstructorId(e.target.value)}
                        >
                            <option value="">Select an instructor...</option>
                            {instructors.map(instructor => (
                                <option key={instructor.uid} value={instructor.uid}>
                                    {instructor.displayName || instructor.email || 'Instructor'}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
             </div>

             <div className="border-t pt-4 space-y-4">
                 <div className="space-y-2">
                    <Label>Student Match</Label>
                    {!isCreatingStudent ? (
                        <div className="flex gap-2">
                            <select 
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={selectedStudentId} 
                                onChange={e => setSelectedStudentId(e.target.value)}
                            >
                                <option value="">Select a student...</option>
                                {sortedStudents.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                            <Button variant="outline" size="icon" onClick={() => setIsCreatingStudent(true)}><Plus className="w-4 h-4" /></Button>
                        </div>
                    ) : (
                        <div className="space-y-3 p-3 bg-muted/50 rounded-lg border">
                            <div className="space-y-1">
                                <Label className="text-xs">Student Name</Label>
                                <Input value={studentName} onChange={e => setStudentName(e.target.value)} />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Student Home Address (Required for AI Map)</Label>
                                <Input value={newStudentAddress} onChange={e => setNewStudentAddress(e.target.value)} placeholder="123 Main St, Toronto" />
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setIsCreatingStudent(false)}>Cancel new student</Button>
                        </div>
                    )}
                 </div>
             </div>

             <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={handleReset}>Cancel</Button>
                <Button onClick={handleCalculateTimes} disabled={isProcessing}>
                    {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MapPin className="w-4 h-4 mr-2" />}
                    Calculate Timeline
                </Button>
             </div>
          </div>
        )}

        {step === 3 && (
            <div className="space-y-6 py-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 text-center">
                    <div className="space-y-2">
                        <Label className="text-[10px] sm:text-xs text-muted-foreground">Travel</Label>
                        <div className="flex items-center justify-center gap-1">
                            <Input type="number" value={travelMins} onChange={e => setTravelMins(Number(e.target.value))} className="w-12 sm:w-16 h-8 text-center" />
                            <span className="text-xs sm:text-sm">m</span>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] sm:text-xs text-muted-foreground">Lesson</Label>
                        <div className="flex items-center justify-center gap-1">
                            <Input type="number" value={lessonMins} onChange={e => setLessonMins(Number(e.target.value))} className="w-12 sm:w-16 h-8 text-center" />
                            <span className="text-xs sm:text-sm">m</span>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] sm:text-xs text-muted-foreground">Early Arrive</Label>
                        <div className="flex items-center justify-center gap-1">
                            <Input type="number" value={earlyMins} onChange={e => setEarlyMins(Number(e.target.value))} className="w-12 sm:w-16 h-8 text-center" />
                            <span className="text-xs sm:text-sm">m</span>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] sm:text-xs text-muted-foreground">Exam</Label>
                        <div className="flex items-center justify-center gap-1">
                            <Input type="number" value={examMins} onChange={e => setExamMins(Number(e.target.value))} className="w-12 sm:w-16 h-8 text-center" />
                            <span className="text-xs sm:text-sm">m</span>
                        </div>
                    </div>
                </div>

                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3">
                    <h4 className="font-semibold flex items-center gap-2"><Car className="w-4 h-4 text-primary" /> Generated Timeline</h4>
                    <ul className="text-sm space-y-2 text-muted-foreground">
                        <li className="flex justify-between"><span>Pickup from Home</span> <span>-{travelMins + lessonMins + earlyMins} mins</span></li>
                        <li className="flex justify-between"><span>Warm-up Lesson</span> <span>-{lessonMins + earlyMins} mins</span></li>
                        <li className="flex justify-between"><span>Early Arrival</span> <span>-{earlyMins} mins</span></li>
                        <li className="flex justify-between font-medium text-foreground"><span>Exam Time ({resolvedExamCenter})</span> <span>{examTime}</span></li>
                        <li className="flex justify-between"><span>Drop-off at Home</span> <span>+{examMins + travelMins} mins</span></li>
                    </ul>
                    <div className="border-t border-primary/10 pt-2 mt-2 font-bold text-primary flex justify-between">
                        <span>Total Blocked Time:</span>
                        <span>{travelMins * 2 + lessonMins + earlyMins + examMins} mins</span>
                    </div>
                </div>

                <label className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-3 text-sm">
                    <Checkbox checked={sendSms} onCheckedChange={checked => setSendSms(Boolean(checked))} />
                    <span className="font-medium">Send schedule message to the student after saving</span>
                </label>

                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
                    <Button onClick={handleSave} disabled={isProcessing}>
                        {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        Save Event to Calendar
                    </Button>
                </div>
            </div>
        )}

      </DialogContent>
    </Dialog>
  );
}
