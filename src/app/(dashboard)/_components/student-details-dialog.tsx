'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Student, StudentStatus } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Edit, MoreVertical, Trash2, Plus, Copy, Phone, MapPin, CheckCircle2, User as UserIcon, FileText, ChevronDown, Camera, Loader2, CalendarCheck2, Car, GitMerge, ReceiptText, Tag, X, UserPlus, Eye, Download, ImageOff } from 'lucide-react';
import { format } from 'date-fns';
import { usePayments } from '@/hooks/use-payments';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, cn } from '@/lib/utils';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import { useStudents } from '@/hooks/use-students';
import { useEvents } from '@/hooks/use-events';
import { useStorage } from '@/hooks/use-storage';
import { getScanErrorMessage, prepareLicenseFileForAi, scanLicenseFile } from '@/lib/license-scan-client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { StudentForm } from '@/app/(dashboard)/students/form/_components/student-form';
import { LicenseImagePreviewDialog } from './license-image-preview-dialog';

interface StudentDetailsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  student: Student | null;
  onEdit: (student: Student) => void;
  onDelete: (studentId: string) => void;
  onStatusChange: (studentId: string, status: StudentStatus) => void;
}

const statusOptions: StudentStatus[] = ['active', 'booked', 'on-hold', 'deactivated'];
const defaultCustomerTags = ['Failed', 'Passed', 'Payment Done', 'Pending'];

function normalizeTagName(tag: string) {
  return tag.trim().replace(/\s+/g, ' ');
}

export function StudentDetailsDialog({
  isOpen,
  onOpenChange,
  student,
  onEdit,
  onDelete,
  onStatusChange,
}: StudentDetailsDialogProps) {
  const { payments, updatePayment } = usePayments();
  const { events, updateEvent } = useEvents();
  const { students, updateStudent, deleteStudent } = useStudents();
  const router = useRouter();
  const { toast } = useToast();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isScanningLicense, setIsScanningLicense] = useState(false);
  const { uploadLicenseFile, isUploading: isUploadingLicense, uploadProgress: licenseUploadProgress } = useStorage();
  const [isMergeOpen, setIsMergeOpen] = useState(false);
  const [mergeStudentId, setMergeStudentId] = useState('');
  const [isMerging, setIsMerging] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isLicensePreviewOpen, setIsLicensePreviewOpen] = useState(false);
  const [localTags, setLocalTags] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [newNote, setNewNote] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isAddressNavigationOpen, setIsAddressNavigationOpen] = useState(false);
  const profileScanInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const tagsArray = Array.isArray(student?.tags) ? student.tags : [];
    setLocalTags(tagsArray.filter(t => t && typeof t === 'string'));
    setNewTagName('');
  }, [student?.id, student?.tags]);

  const studentPayments = useMemo(() => {
    return student ? payments.filter(p => p.studentId === student.id).sort((a,b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()) : [];
  }, [student, payments]);

  const studentLessons = useMemo(() => {
    return student
      ? events
          .filter(event => event.studentId === student.id)
          .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime())
      : [];
  }, [student, events]);

  const billableTakenLessons = useMemo(() => {
    const now = Date.now();
    return studentLessons.filter(lesson => {
      const lessonTime = new Date(lesson.start).getTime();
      const lessonStatus = lesson.lessonStatus || 'scheduled';
      return (
        lessonTime <= now &&
        lessonStatus !== 'cancelled' &&
        lessonStatus !== 'no-show' &&
        lesson.paymentStatus !== 'paid' &&
        (lesson.services || []).length > 0
      );
    });
  }, [studentLessons]);

  const mergeCandidates = useMemo(() => {
    if (!student || !students) return [];
    const normalizedName = (student.name || '').trim().toLowerCase();
    const normalizedMobile = (student.mobileNumber || '').replace(/\D/g, '');
    const normalizedLicense = (student.licenseNumber || '').replace(/\W/g, '').toLowerCase();

    return students
      .filter(candidate => candidate.id !== student.id)
      .map(candidate => {
        const candidateName = (candidate.name || '').trim().toLowerCase();
        const candidateMobile = (candidate.mobileNumber || '').replace(/\D/g, '');
        const candidateLicense = (candidate.licenseNumber || '').replace(/\W/g, '').toLowerCase();
        const score =
          (normalizedLicense && candidateLicense === normalizedLicense ? 4 : 0) +
          (normalizedMobile && candidateMobile === normalizedMobile ? 3 : 0) +
          (normalizedName && candidateName === normalizedName ? 2 : 0) +
          (normalizedName && candidateName.includes(normalizedName) ? 1 : 0);

        return { candidate, score };
      })
      .sort((a, b) => b.score - a.score || a.candidate.name.localeCompare(b.candidate.name))
      .map(({ candidate }) => candidate);
  }, [student, students]);

  const selectedMergeStudent = useMemo(
    () => mergeCandidates.find(candidate => candidate.id === mergeStudentId) || null,
    [mergeCandidates, mergeStudentId]
  );

  const allAvailableTags = useMemo(() => {
    const tagsSet = new Set<string>(defaultCustomerTags);
    (students || []).forEach(s => {
      if (Array.isArray(s.tags)) {
        s.tags.forEach(t => {
          if (t && typeof t === 'string') {
            tagsSet.add(t);
          }
        });
      }
    });
    return Array.from(tagsSet).sort();
  }, [students]);

  if (!student) return null;

  const studentAddress = student.address?.trim();
  const studentWazeUrl = studentAddress
    ? `https://waze.com/ul?q=${encodeURIComponent(studentAddress)}&navigate=yes`
    : '';

  const handleEdit = () => {
    setIsEditMode(true);
  };
  
  const handleDelete = () => {
      onDelete(student.id);
  }

  const handleOpenMerge = () => {
    setMergeStudentId(mergeCandidates[0]?.id || '');
    setIsMergeOpen(true);
  };

  const handleMergeDuplicate = async () => {
    if (!selectedMergeStudent || !student) {
      toast({ variant: 'destructive', title: 'Choose a duplicate contact first.' });
      return;
    }

    setIsMerging(true);
    try {
      const mergedComments = [
        student.comments,
        selectedMergeStudent.comments ? `Merged from ${selectedMergeStudent.name}: ${selectedMergeStudent.comments}` : '',
      ].filter(Boolean).join('\n\n');

      await updateStudent({
        id: student.id,
        mobileNumber: student.mobileNumber || selectedMergeStudent.mobileNumber || '',
        address: student.address || selectedMergeStudent.address || '',
        birthdate: student.birthdate || selectedMergeStudent.birthdate || '',
        licenseNumber: student.licenseNumber || selectedMergeStudent.licenseNumber || '',
        licenseExpiry: student.licenseExpiry || selectedMergeStudent.licenseExpiry || '',
        licenseType: student.licenseType || selectedMergeStudent.licenseType,
        status: student.status === 'deactivated' ? selectedMergeStudent.status : student.status,
        registrationDate: new Date(
          Math.min(
            new Date(student.registrationDate || new Date()).getTime(),
            new Date(selectedMergeStudent.registrationDate || new Date()).getTime()
          )
        ).toISOString(),
        comments: mergedComments,
      });

      await Promise.all(
        payments
          .filter(payment => payment.studentId === selectedMergeStudent.id)
          .map(payment => updatePayment({ ...payment, studentId: student.id, studentName: student.name }))
      );

      await Promise.all(
        events
          .filter(event => event.studentId === selectedMergeStudent.id)
          .map(event => updateEvent({ id: event.id, studentId: student.id, studentName: student.name }))
      );

      await deleteStudent(selectedMergeStudent.id);

      toast({
        title: 'Contacts merged',
        description: `${selectedMergeStudent.name}'s payments and lessons now belong to ${student.name}.`,
      });
      setIsMergeOpen(false);
      setMergeStudentId('');
    } catch (error) {
      toast({ variant: 'destructive', title: 'Merge failed', description: 'Please try again.' });
    } finally {
      setIsMerging(false);
    }
  };

  const handleStatusChange = (status: StudentStatus) => {
    onStatusChange(student.id, status);
  };
  
  const handleAddToBill = () => {
    if (student) {
      onOpenChange(false);
      router.push(`/payments?studentId=${student.id}`);
    }
  };

  const handleBillLessons = (lessonIds: string[]) => {
    if (!student || lessonIds.length === 0) return;
    onOpenChange(false);
    router.push(`/payments?studentId=${student.id}&eventIds=${encodeURIComponent(lessonIds.join(','))}`);
  };

  const handleScheduleExam = () => {
    onOpenChange(false);
    router.push(`/schedule?examStudentId=${student.id}`);
  };

  const handleCopyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast({ title: 'Copied to clipboard!', description: `${field} copied.` });
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleViewLicenseImage = () => {
    if (!student.licenseImageUrl) return;
    setIsLicensePreviewOpen(true);
  };

  const handleDownloadLicenseImage = () => {
    if (!student.licenseImageUrl) return;
    const link = document.createElement('a');
    link.href = student.licenseImageUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.download = `${student.name.replace(/[^a-z0-9]+/gi, '_')}_license`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveToContacts = () => {
    if (!student) return;

    const nameParts = student.name.split(' ');
    const lastName = nameParts.length > 1 ? nameParts.pop() : '';
    const firstName = `Student ${nameParts.join(' ')}`;
    const fullName = `Student ${student.name}`;

    let vcard = `BEGIN:VCARD\nVERSION:3.0\nN:${lastName || ''};${firstName || ''};;;\nFN:${fullName}\n`;
    if (student.mobileNumber) {
      vcard += `TEL;TYPE=CELL:${student.mobileNumber}\n`;
    }
    if (student.address) {
      vcard += `ADR;TYPE=HOME:;;${student.address}\n`;
    }
    vcard += `NOTE:License: ${student.licenseNumber}\nExpiry: ${student.licenseExpiry}\nClass: ${student.licenseType}\n`;
    vcard += `END:VCARD`;

    const blob = new Blob([vcard], { type: 'text/vcard;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${student.name.replace(/\s+/g, '_')}.vcf`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({ title: 'Contact downloaded', description: 'Open the file to save to your contacts.' });
  };

  const handleProfileLicenseScan = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !student) return;

    setIsScanningLicense(true);
    toast({ title: 'Saving and scanning license...', description: `The license image is being saved to ${student.name}'s profile first.` });

    try {
      const uploadedUrl = await uploadLicenseFile(student.id, file);
      const licenseFile = await prepareLicenseFileForAi(file);
      let details;
      try {
        details = await scanLicenseFile(licenseFile);
      } catch (scanError) {
        await updateStudent({
          id: student.id,
          licenseImageUrl: uploadedUrl,
        });
        toast({
          variant: 'destructive',
          title: 'License image saved, scan failed',
          description: 'The full license image was saved. Please edit the details manually or try scanning again.',
        });
        return;
      }

      await updateStudent({
        id: student.id,
        address: details.address || student.address || '',
        birthdate: details.birthdate || student.birthdate || '',
        licenseNumber: details.licenseNumber || student.licenseNumber || '',
        licenseExpiry: details.licenseExpiry || student.licenseExpiry || '',
        ...(details.avatarUrl ? { avatarUrl: details.avatarUrl } : {}),
        licenseImageUrl: uploadedUrl,
      });

      toast({
        title: 'License updated',
        description: details.avatarUrl
          ? 'License image, details, and face thumbnail were saved. Name was kept the same.'
          : 'License image, address, birthdate, license number, and expiry were saved. Name was kept the same.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Scan failed',
        description: getScanErrorMessage(error),
      });
    } finally {
      setIsScanningLicense(false);
      if (profileScanInputRef.current) {
        profileScanInputRef.current.value = '';
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800/50';
      case 'booked': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800/50';
      case 'on-hold': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800/50';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700';
    }
  };

  const saveTags = async (nextTags: string[]) => {
    const cleanTags = Array.from(
      new Set(nextTags.map(normalizeTagName).filter(Boolean))
    );
    setLocalTags(cleanTags);
    await updateStudent({ id: student.id, tags: cleanTags });
  };

  const handleAddTag = async (tag: string) => {
    const cleanTag = normalizeTagName(tag);
    if (!cleanTag) return;
    await saveTags([...localTags, cleanTag]);
    setNewTagName('');
  };

  const handleRemoveTag = async (tag: string) => {
    if (!tag || typeof tag !== 'string') return;
    await saveTags(localTags.filter(item => item && typeof item === 'string' && item.toLowerCase() !== tag.toLowerCase()));
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !student) return;
    setIsSavingNote(true);
    try {
      const updatedComments = student.comments 
        ? `${student.comments}\n\n[${format(new Date(), 'MMM dd, yyyy')}]\n${newNote.trim()}` 
        : `[${format(new Date(), 'MMM dd, yyyy')}]\n${newNote.trim()}`;
      await updateStudent({ id: student.id, comments: updatedComments });
      setNewNote('');
    } catch (error) {
      toast({ variant: 'destructive', title: 'Failed to add note' });
    } finally {
      setIsSavingNote(false);
    }
  };

  const quickTags = allAvailableTags.filter(
    tag => tag && typeof tag === 'string' && !localTags.some(item => item && typeof item === 'string' && item.toLowerCase() === tag.toLowerCase())
  );

  const getLessonStatusLabel = (status?: string) => {
    if (status === 'no-show') return 'No Show';
    if (status === 'cancelled') return 'Cancelled';
    return 'Scheduled';
  };

  const getLessonStatusClass = (status?: string) => {
    if (status === 'no-show') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
    if (status === 'cancelled') return 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent 
        onEscapeKeyDown={(e) => { e.preventDefault(); onOpenChange(false); }}
        className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 border border-border/50 shadow-2xl bg-background rounded-2xl sm:rounded-[2rem]"
      >
        
        {/* Header Section */}
        <div className="bg-[#0D1B2A] text-white p-6 sm:p-8 pb-10 relative">
          <input
            ref={profileScanInputRef}
            type="file"
            className="hidden"
            tabIndex={-1}
            accept="image/*,.heic,.heif,.pdf,application/pdf"
            onChange={handleProfileLicenseScan}
          />
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#C9A84C]/20 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
          
          <div className="flex justify-between items-start relative z-10">
            <div className="flex items-center gap-4 sm:gap-5">
              <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full flex items-center justify-center text-2xl sm:text-3xl font-bold shadow-xl border-4 border-[#0D1B2A] ring-2 ring-white/10 shrink-0 overflow-hidden relative group">
                {student.avatarUrl ? (
                  <img src={student.avatarUrl} alt={student.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-[#C9A84C] to-[#a38535] flex items-center justify-center text-white">
                    {student.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <DialogTitle className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-none">
                  {student.name}
                </DialogTitle>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Badge variant="outline" className={cn("capitalize cursor-pointer shadow-sm hover:opacity-80 transition-opacity flex items-center gap-1", getStatusColor(student.status))}>
                        {student.status.replace('-', ' ')} <ChevronDown className="w-3 h-3" />
                      </Badge>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {statusOptions.map((status) => (
                        <DropdownMenuItem key={status} onSelect={() => handleStatusChange(status)} className="capitalize">
                          {status.replace('-', ' ')}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <span className="text-white/50 text-xs sm:text-sm flex items-center gap-1 font-medium">
                    <UserIcon className="w-3 h-3" />
                    Joined {format(new Date(student.registrationDate), 'MMM yyyy')}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <Button onClick={handleSaveToContacts} variant="ghost" size="icon" className="text-white hover:bg-white/10 h-9 w-9 rounded-full" title="Save to Contacts">
                <UserPlus className="h-5 w-5" />
              </Button>
              <Button onClick={handleAddToBill} className="bg-[#C9A84C] text-[#0D1B2A] hover:bg-[#F0D080] shadow-md font-semibold border-0 hidden sm:flex h-9 rounded-full px-4">
                <Plus className="h-4 w-4 mr-1.5" /> New Bill
              </Button>
              <Button onClick={handleAddToBill} size="icon" className="bg-[#C9A84C] text-[#0D1B2A] hover:bg-[#F0D080] shadow-md border-0 sm:hidden h-9 w-9 rounded-full">
                <Plus className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 h-9 w-9 rounded-full">
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 rounded-xl p-1.5 shadow-xl">
                  <DropdownMenuItem
                    onClick={() => profileScanInputRef.current?.click()}
                    disabled={isScanningLicense}
                    className="rounded-md cursor-pointer"
                  >
                    {isScanningLicense ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                    <span className="font-medium">Scan License</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleScheduleExam} className="rounded-md cursor-pointer">
                    <Car className="mr-2 h-4 w-4" />
                    <span className="font-medium">Schedule Exam</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleEdit} className="rounded-md cursor-pointer">
                    <Edit className="mr-2 h-4 w-4" />
                    <span className="font-medium">Edit Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleOpenMerge} className="rounded-md cursor-pointer">
                    <GitMerge className="mr-2 h-4 w-4" />
                    <span className="font-medium">Merge Duplicate</span>
                  </DropdownMenuItem>
                  <AlertDialog>
                      <AlertDialogTrigger asChild>
                          <div className="relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors hover:bg-red-50 focus:bg-red-50 text-red-600 dark:hover:bg-red-950/50 dark:focus:bg-red-950/50 dark:text-red-500 mt-1">
                              <Trash2 className="h-4 w-4" />
                              <span className="font-medium">Delete Student</span>
                          </div>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-2xl">
                          <AlertDialogHeader>
                          <AlertDialogTitle>Delete this student?</AlertDialogTitle>
                          <AlertDialogDescription>
                              This will permanently delete {student.name} and all associated data. This action cannot be undone.
                          </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                          <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white rounded-full shadow-md">Delete</AlertDialogAction>
                          </AlertDialogFooter>
                      </AlertDialogContent>
                  </AlertDialog>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>


        </div>

        {/* License ID Card Section (Prominent) */}
        <div className="px-6 sm:px-8 -mt-6 relative z-10">
          <div className="bg-card border border-border/60 rounded-2xl shadow-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-5 relative overflow-hidden backdrop-blur-sm bg-background/95">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#C9A84C]/10 to-transparent rounded-bl-full -z-10 pointer-events-none" />
            
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-4">
              
              <div className="group">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#C9A84C]" /> License Number
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-xl sm:text-2xl font-mono font-bold tracking-tight text-foreground">
                    {student.licenseNumber}
                  </p>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors rounded-full"
                    onClick={() => handleCopyToClipboard(student.licenseNumber, 'License')}
                    title="Copy License Number"
                  >
                    {copiedField === 'License' ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="flex gap-8 sm:justify-end sm:pr-4">
                <div className="group">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1.5">Expiry</p>
                  <div className="flex items-center gap-2">
                    <p className="text-lg sm:text-xl font-mono font-semibold text-foreground">
                      {student.licenseExpiry.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')}
                    </p>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors rounded-full"
                      onClick={() => handleCopyToClipboard(student.licenseExpiry, 'Expiry')}
                      title="Copy Expiry Date"
                    >
                      {copiedField === 'Expiry' ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1.5">Class</p>
                  <Badge variant="secondary" className="text-sm sm:text-base font-bold bg-[#0D1B2A] text-[#F0D080] dark:bg-[#C9A84C] dark:text-[#0D1B2A] border-0 rounded-md px-3">
                    {student.licenseType}
                  </Badge>
                </div>
              </div>

              {student.licenseImageUrl && (
                <div className="col-span-1 sm:col-span-2 flex flex-col gap-2 mt-2 sm:-mt-2 border-t border-border/40 pt-4 sm:border-t-0 sm:pt-0">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold sm:text-right">Saved license image</p>
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-[#C9A84C]/30 text-[#C9A84C] hover:bg-[#C9A84C]/10"
                      onClick={handleViewLicenseImage}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-[#C9A84C]/30 text-[#C9A84C] hover:bg-[#C9A84C]/10"
                      onClick={handleDownloadLicenseImage}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </div>
              )}
              {!student.licenseImageUrl && (
                <div className="col-span-1 sm:col-span-2 flex items-center gap-2 rounded-xl border border-dashed border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  <ImageOff className="h-4 w-4 shrink-0" />
                  No license image saved yet. Use Scan License from the menu to attach one.
                  {isUploadingLicense && <span className="ml-auto shrink-0 font-medium">Uploading {Math.round(licenseUploadProgress)}%</span>}
                </div>
              )}

            </div>
          </div>
        </div>

        {/* Details Tabs */}
        <div className="p-6 sm:p-8 pt-6">
          <Tabs defaultValue="contact" className="w-full">
            <TabsList className="w-full grid grid-cols-4 mb-6 bg-muted/40 p-1.5 rounded-xl">
              <TabsTrigger value="contact" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary font-medium py-2">Contact</TabsTrigger>
              <TabsTrigger value="lessons" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary font-medium py-2">Lessons</TabsTrigger>
              <TabsTrigger value="notes" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary font-medium py-2">Notes</TabsTrigger>
              <TabsTrigger value="payments" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary font-medium py-2">Payments</TabsTrigger>
            </TabsList>
            
            <TabsContent value="contact" className="space-y-4 outline-none focus-visible:ring-0 animate-in fade-in duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {student.mobileNumber && (
                  <div className="flex items-start gap-4 p-4 rounded-xl border border-border/50 bg-card/30 hover:bg-card/80 transition-colors">
                    <div className="bg-primary/10 p-2.5 rounded-full mt-0.5 text-primary">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Mobile Number</p>
                      <div className="flex items-center gap-2">
                        <a href={`tel:${student.mobileNumber}`} className="font-medium text-base text-primary hover:underline" title="Call student">
                          {student.mobileNumber}
                        </a>
                        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-muted" onClick={() => handleCopyToClipboard(student.mobileNumber, 'Phone')} title="Copy number">
                          {copiedField === 'Phone' ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-4 p-4 rounded-xl border border-border/50 bg-card/30 hover:bg-card/80 transition-colors">
                  <div className="bg-primary/10 p-2.5 rounded-full mt-0.5 text-primary">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Date of Birth</p>
                    <p className="font-medium text-base">{student.birthdate.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')}</p>
                  </div>
                </div>

                {studentAddress ? (
                  <button
                    type="button"
                    onClick={() => setIsAddressNavigationOpen(true)}
                    className="flex w-full items-start gap-4 rounded-xl border border-border/50 bg-card/30 p-4 text-left transition-colors hover:border-primary/30 hover:bg-card/80 md:col-span-2"
                  >
                    <div className="mt-0.5 shrink-0 rounded-full bg-primary/10 p-2.5 text-primary">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Address</p>
                      <p className="text-base font-medium leading-relaxed text-foreground">{studentAddress}</p>
                      <p className="mt-1 text-xs font-medium text-primary">Tap to open navigation</p>
                    </div>
                  </button>
                ) : (
                  <div className="flex items-start gap-4 p-4 rounded-xl border border-border/50 bg-card/30 md:col-span-2">
                    <div className="bg-primary/10 p-2.5 rounded-full mt-0.5 text-primary shrink-0">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Address</p>
                      <p className="font-medium text-base leading-relaxed">No address provided.</p>
                    </div>
                  </div>
                )}

              </div>
            </TabsContent>

            <TabsContent value="lessons" className="outline-none focus-visible:ring-0 animate-in fade-in duration-300">
              <div className="border border-border/50 rounded-xl overflow-hidden bg-card shadow-sm">
                <div className="flex flex-col gap-3 border-b bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold">Lesson billing</p>
                    <p className="text-xs text-muted-foreground">
                      {billableTakenLessons.length > 0
                        ? `${billableTakenLessons.length} taken lesson${billableTakenLessons.length === 1 ? '' : 's'} ready to bill.`
                        : 'No taken unpaid lessons ready to bill.'}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleBillLessons(billableTakenLessons.map(lesson => lesson.id))}
                    disabled={billableTakenLessons.length === 0}
                    className="h-9 rounded-full bg-[#C9A84C] px-4 font-semibold text-[#0D1B2A] hover:bg-[#F0D080]"
                  >
                    <ReceiptText className="mr-2 h-4 w-4" />
                    Bill Taken
                  </Button>
                </div>
                <ScrollArea className="h-[260px]">
                  <div className="divide-y">
                    {studentLessons.length > 0 ? studentLessons.map(lesson => {
                      const lessonDate = new Date(lesson.start);
                      const services = lesson.services?.map(service => service.name).join(', ') || lesson.examCenter || 'Lesson';
                      const isPastLesson = lessonDate.getTime() < Date.now();
                      const lessonStatus = lesson.lessonStatus || 'scheduled';
                      const canBillLesson = isPastLesson && lessonStatus !== 'cancelled' && lessonStatus !== 'no-show' && lesson.paymentStatus !== 'paid' && (lesson.services || []).length > 0;
                      return (
                        <div 
                          key={lesson.id} 
                          className="p-4 hover:bg-muted/50 transition-colors cursor-pointer group"
                          onClick={() => {
                            onOpenChange(false);
                            router.push(`/schedule?eventId=${lesson.id}`);
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 group-hover:text-primary transition-colors">
                                <CalendarCheck2 className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                <p className="font-semibold text-sm">
                                  {format(lessonDate, 'MMM dd, yyyy')} at {format(lessonDate, 'h:mm a')}
                                </p>
                              </div>
                              <p className="mt-1 text-sm text-muted-foreground truncate">{services}</p>
                              {lesson.notes && (
                                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{lesson.notes}</p>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1.5">
                              <Badge className={cn("shadow-none", getLessonStatusClass(lesson.lessonStatus))}>
                                {getLessonStatusLabel(lesson.lessonStatus)}
                              </Badge>
                              <Badge variant={lesson.paymentStatus === 'paid' ? 'default' : 'outline'} className="shadow-none">
                                {lesson.paymentStatus === 'paid' ? 'Paid' : lesson.paymentStatus === 'unpaid' ? 'Unpaid' : isPastLesson ? 'Taken' : 'Booked'}
                              </Badge>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleBillLessons([lesson.id]);
                                }}
                                disabled={!canBillLesson}
                                className="h-8 rounded-full px-3 text-xs"
                              >
                                <ReceiptText className="mr-1.5 h-3.5 w-3.5" />
                                Bill
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    }) : (
                      <div className="flex min-h-[180px] flex-col items-center justify-center p-6 text-center text-muted-foreground">
                        <div className="bg-muted p-4 rounded-full mb-3">
                          <CalendarCheck2 className="w-6 h-6 opacity-40" />
                        </div>
                        <p className="text-sm font-medium">No lessons found.</p>
                        <p className="text-xs opacity-70 mt-1">Scheduled lessons for this student will show here.</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>

            <TabsContent value="notes" className="outline-none focus-visible:ring-0 animate-in fade-in duration-300">
              <div className="flex flex-col gap-4">
                <div className="bg-card border border-border/50 rounded-xl p-5 min-h-[120px] shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-[#C9A84C]" />
                  {student.comments ? (
                    <div className="flex gap-4">
                      <FileText className="w-5 h-5 text-muted-foreground/50 shrink-0 mt-0.5" />
                      <p className="text-sm sm:text-base whitespace-pre-wrap leading-relaxed text-foreground/90">{student.comments}</p>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-6">
                      <div className="bg-muted p-4 rounded-full mb-3">
                        <FileText className="w-6 h-6 opacity-40" />
                      </div>
                      <p className="text-sm font-medium">No notes available.</p>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Textarea 
                    placeholder="Add a new note..." 
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    className="min-h-[80px]"
                  />
                  <div className="flex justify-end">
                    <Button size="sm" onClick={handleAddNote} disabled={isSavingNote || !newNote.trim()}>
                      {isSavingNote ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                      Add Note
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="payments" className="outline-none focus-visible:ring-0 animate-in fade-in duration-300">
              <div className="border border-border/50 rounded-xl overflow-hidden bg-card shadow-sm">
                <ScrollArea className="h-[220px]">
                  <Table>
                    <TableHeader className="bg-muted/40 sticky top-0 z-10 backdrop-blur-md">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground h-10">Date</TableHead>
                        <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground h-10">Amount</TableHead>
                        <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground text-right h-10 pr-6">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {studentPayments.length > 0 ? studentPayments.map(payment => (
                        <TableRow key={payment.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="py-3 text-sm font-medium">{format(new Date(payment.paymentDate), 'MMM dd, yyyy')}</TableCell>
                          <TableCell className="py-3 font-semibold text-sm">{formatCurrency(payment.total)}</TableCell>
                          <TableCell className="py-3 text-right pr-6">
                            <Badge 
                              variant={payment.status === 'paid' ? 'default' : 'destructive'} 
                              className={cn(
                                "capitalize font-semibold shadow-none",
                                payment.status === 'paid' ? "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-400" : ""
                              )}
                            >
                              {payment.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      )) : (
                        <TableRow>
                          <TableCell colSpan={3} className="h-32 text-center text-muted-foreground">
                            <div className="flex flex-col items-center justify-center">
                              <span className="font-medium text-sm">No payment history found.</span>
                              <Button variant="link" size="sm" onClick={handleAddToBill} className="mt-1 h-auto p-0 text-[#C9A84C]">
                                Create their first bill
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </TabsContent>
          </Tabs>

          <div className="mt-6 relative z-10 rounded-2xl border border-border/50 bg-muted/30 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Tag className="h-4 w-4 text-[#C9A84C]" />
              Tags
            </div>
            <div className="flex flex-wrap gap-2">
              {localTags.length > 0 ? (
                localTags.map(tag => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="gap-1 border-border bg-background text-foreground hover:bg-muted"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 rounded-full text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={`Remove ${tag} tag`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">No tags yet</span>
              )}
            </div>
            {quickTags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {quickTags.map(tag => (
                  <Button
                    key={tag}
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => handleAddTag(tag)}
                    className="h-7 rounded-full bg-background border border-border/50 px-3 text-xs text-foreground hover:bg-muted shadow-sm"
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    {tag}
                  </Button>
                ))}
              </div>
            )}
            <form
              className="mt-4 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void handleAddTag(newTagName);
              }}
            >
              <Input
                value={newTagName}
                onChange={(event) => setNewTagName(event.target.value)}
                placeholder="Add custom tag"
                className="h-9 border-border bg-background text-foreground placeholder:text-muted-foreground"
              />
              <Button type="submit" size="sm" className="h-9 bg-[#C9A84C] text-[#0D1B2A] hover:bg-[#F0D080]">
                Add
              </Button>
            </form>
          </div>
        </div>

      </DialogContent>
    </Dialog>
    <LicenseImagePreviewDialog
      isOpen={isLicensePreviewOpen}
      onOpenChange={setIsLicensePreviewOpen}
      imageUrl={student.licenseImageUrl || ''}
      studentName={student.name}
      onDownload={handleDownloadLicenseImage}
    />
    <AlertDialog open={isAddressNavigationOpen} onOpenChange={setIsAddressNavigationOpen}>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Open navigation?</AlertDialogTitle>
          <AlertDialogDescription>
            Open Waze directions to {studentAddress || 'this student address'}.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
          <AlertDialogAction asChild className="rounded-full bg-sky-600 hover:bg-sky-700">
            <a href={studentWazeUrl} target="_blank" rel="noopener noreferrer">
              Open Waze
            </a>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <Dialog open={isMergeOpen} onOpenChange={setIsMergeOpen}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Merge duplicate contact</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-xl border bg-muted/30 p-3 text-sm">
            <p className="font-semibold">Keep this contact:</p>
            <p className="text-muted-foreground">{student.name}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Duplicate contact to merge and delete</p>
            <Select value={mergeStudentId} onValueChange={setMergeStudentId}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Choose duplicate student" />
              </SelectTrigger>
              <SelectContent>
                {mergeCandidates.map(candidate => (
                  <SelectItem key={candidate.id} value={candidate.id}>
                    {candidate.name}
                    {candidate.mobileNumber ? ` - ${candidate.mobileNumber}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedMergeStudent && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              This will move payments and scheduled lessons from {selectedMergeStudent.name} to {student.name}, then delete the duplicate record.
            </div>
          )}
          {mergeCandidates.length === 0 && (
            <div className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
              No other contacts are available to merge.
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setIsMergeOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-xl"
              onClick={handleMergeDuplicate}
              disabled={!selectedMergeStudent || isMerging}
            >
              {isMerging ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GitMerge className="mr-2 h-4 w-4" />}
              Merge
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <Sheet open={isEditMode} onOpenChange={setIsEditMode}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit Profile</SheetTitle>
        </SheetHeader>
        <div className="mt-6">
          {isEditMode && student && (
            <StudentForm 
              student={student} 
              onSuccess={() => setIsEditMode(false)} 
              onCancel={() => setIsEditMode(false)} 
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
    </>
  );
}
