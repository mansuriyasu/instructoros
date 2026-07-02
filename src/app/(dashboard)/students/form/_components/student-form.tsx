'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
import { Student } from '@/lib/types';
import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useStudents } from '@/hooks/use-students';
import { useSmsLogs } from '@/hooks/use-sms-logs';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Camera, Download, Eye, FileImage, Loader2 } from 'lucide-react';
import { useUser } from '@/firebase';
import { getScanErrorMessage, prepareLicenseFileForAi, scanLicenseFile } from '@/lib/license-scan-client';
import { useStorage } from '@/hooks/use-storage';
import { MissingPhoneDialog } from '@/app/(dashboard)/_components/missing-phone-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { LicenseImagePreviewDialog } from '@/app/(dashboard)/_components/license-image-preview-dialog';

const studentSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  mobileNumber: z.string().optional(),
  address: z.string().optional(),
  birthdate: z.string().optional(),
  licenseNumber: z.string().optional(),
  licenseExpiry: z.string().optional(),
  licenseType: z.enum(['G', 'G2']).optional(),
  comments: z.string().optional(),
});

function getSaveErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/permission|insufficient permissions|permission-denied/i.test(message)) {
    return 'Firebase blocked the save. Please make sure this website domain is allowed in Firebase Authentication, then try again.';
  }
  if (/sign-in|signed in|auth/i.test(message)) {
    return 'The app is still connecting to Firebase sign-in. Please refresh the page and try again.';
  }
  return message || 'Failed to save student.';
}

interface StudentFormProps {
  student?: Student | null;
  onSuccess?: (student: Student) => void;
  onCancel?: () => void;
}

export function StudentForm({ student, onSuccess, onCancel }: StudentFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const { addStudent, updateStudent } = useStudents();
  const { user, isUserLoading } = useUser();
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sendWelcomeSms, setSendWelcomeSms] = useState(false);
  const [missingPhoneStudent, setMissingPhoneStudent] = useState<Student | null>(null);
  const [scannedAvatarUrl, setScannedAvatarUrl] = useState('');
  const [scannedLicenseUrl, setScannedLicenseUrl] = useState('');
  const [isLicensePreviewOpen, setIsLicensePreviewOpen] = useState(false);
  const draftLicenseUploadIdRef = useRef(`new-student-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const { uploadLicenseFile, isUploading: isUploadingLicense, uploadProgress: licenseUploadProgress } = useStorage();

  const form = useForm<z.infer<typeof studentSchema>>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      name: '',
      mobileNumber: '',
      address: '',
      birthdate: '',
      licenseNumber: '',
      licenseExpiry: '',
      licenseType: 'G2',
      comments: '',
    },
  });

  const isEditing = !!student;
  const isAuthReady = !!user;

  useEffect(() => {
    if (student) {
      form.reset({
        name: student.name || '',
        mobileNumber: student.mobileNumber || '',
        address: student.address || '',
        birthdate: student.birthdate || '',
        licenseNumber: student.licenseNumber || '',
        licenseExpiry: student.licenseExpiry || '',
        licenseType: student.licenseType || 'G2',
        comments: student.comments || '',
      });
      setScannedAvatarUrl(student.avatarUrl || '');
      setScannedLicenseUrl(student.licenseImageUrl || '');
    } else {
      form.reset({
        name: '',
        mobileNumber: '',
        address: '',
        birthdate: '',
        licenseNumber: '',
        licenseExpiry: '',
        licenseType: 'G2',
        comments: '',
      });
      setScannedAvatarUrl('');
      setScannedLicenseUrl('');
    }
  }, [student, form]);
  
  const { sendAndLogSms } = useSmsLogs();

  const sendWelcomeSmsMessage = async (mobileNumber: string, studentName: string) => {
    const body = `Hello ${studentName}! Thank you for registering with SparkOn Driving Academy. 🚗

Before your driving lesson, please make sure you:

✅ Bring your valid driver’s licence with you.
✅ Wear comfortable, closed-toe shoes suitable for driving.
❌ Do not wear slippers, flip-flops, high heels, or loose footwear, as they can affect your control of the vehicle.
✅ Arrive 5–10 minutes before your scheduled lesson time.
✅ Bring your glasses or contact lenses if your licence requires them.
✅ Make sure you are well-rested and ready to focus on driving.
✅ If you need to cancel or reschedule, please provide as much notice as possible.

If you have any questions before your lesson, feel free to contact us.

We look forward to helping you become a safe and confident driver!
Thank you! 
Follow for more tricks and tips: www.instagram.com/SparkOnDrive
SparkOn Driving Academy
📞 438-926-2048
🌐 www.sparkondrive.ca`;

    const cleanedNumber = mobileNumber.replace(/\D/g, '');
    const url = `https://api.whatsapp.com/send?phone=1${cleanedNumber}&text=${encodeURIComponent(body)}`;
    window.open(url, '_blank');
  };

  const handleViewSavedLicense = () => {
    if (!scannedLicenseUrl) return;
    setIsLicensePreviewOpen(true);
  };

  const handleDownloadSavedLicense = () => {
    if (!scannedLicenseUrl) return;
    const studentName = form.getValues('name') || student?.name || 'student';
    const link = document.createElement('a');
    link.href = scannedLicenseUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.download = `${studentName.replace(/[^a-z0-9]+/gi, '_')}_license`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const onSubmit = async (values: z.infer<typeof studentSchema>) => {
    try {
      if (!isAuthReady) {
        throw new Error('Firebase sign-in is not ready.');
      }

        const studentData = {
            ...values,
            mobileNumber: values.mobileNumber || '',
            address: values.address || '',
            birthdate: values.birthdate || '',
            licenseNumber: values.licenseNumber || '',
            licenseExpiry: values.licenseExpiry || '',
            licenseType: values.licenseType || 'G2',
            comments: values.comments || '',
            avatarUrl: scannedAvatarUrl || student?.avatarUrl || '',
            licenseImageUrl: scannedLicenseUrl || student?.licenseImageUrl || '',
        };

      if (isEditing && student) {
        await updateStudent({ ...student, ...studentData });
        toast({ title: 'Student updated successfully' });
        if (onSuccess) onSuccess({ ...student, ...studentData } as Student);
        else router.push('/students');
      } else {
        const newRef = await addStudent(studentData);
        toast({ title: 'Student added successfully' });
        
        if (sendWelcomeSms) {
          if (!studentData.mobileNumber?.trim()) {
            setMissingPhoneStudent({ id: newRef.id, ...studentData } as Student);
            return;
          } else {
            sendWelcomeSmsMessage(studentData.mobileNumber, studentData.name);
          }
        }
        if (onSuccess) onSuccess({ id: newRef.id, ...studentData } as Student);
        else router.push('/students');
      }
    } catch (error) {
      console.error('Student save error:', error);
      toast({
        variant: 'destructive',
        title: `Could not ${isEditing ? 'update' : 'add'} student`,
        description: getSaveErrorMessage(error),
      });
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    toast({ title: 'Saving and scanning license...', description: 'The license image is being saved first, then the details will be extracted.' });

    let uploadedUrl = '';
    try {
      const prefix = student?.id || draftLicenseUploadIdRef.current;
      uploadedUrl = await uploadLicenseFile(prefix, file);
      setScannedLicenseUrl(uploadedUrl);

      const licenseFile = await prepareLicenseFileForAi(file);
      const details = await scanLicenseFile(licenseFile);

      form.setValue('name', details.name, { shouldValidate: true });
      form.setValue('address', details.address, { shouldValidate: true });
      form.setValue('birthdate', details.birthdate, { shouldValidate: true });
      form.setValue('licenseNumber', details.licenseNumber, { shouldValidate: true });
      form.setValue('licenseExpiry', details.licenseExpiry, { shouldValidate: true });
      if (details.avatarUrl) {
        setScannedAvatarUrl(details.avatarUrl);
      }

      toast({
        title: 'Scan complete!',
        description: details.avatarUrl
          ? 'Details, face thumbnail, and full license image were saved. Please review before saving.'
          : 'License image saved. Please review the extracted information before saving.',
      });
    } catch (error) {
      console.error('AI extraction error:', error);
      const hasSavedLicense = Boolean(uploadedUrl || scannedLicenseUrl);
      toast({
        variant: 'destructive',
        title: hasSavedLicense ? 'License saved, scan failed' : 'Scan failed',
        description: hasSavedLicense
          ? 'The image was saved. Please fill or correct the fields manually before saving.'
          : getScanErrorMessage(error),
      });
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleLicenseNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (value.length > 15) {
      value = value.substring(0, 15);
    }
    
    let formattedValue = '';
    if (value.length > 10) {
      formattedValue = `${value.slice(0, 5)}-${value.slice(5, 10)}-${value.slice(10)}`;
    } else if (value.length > 5) {
      formattedValue = `${value.slice(0, 5)}-${value.slice(5)}`;
    } else {
      formattedValue = value;
    }
    
    form.setValue('licenseNumber', formattedValue);
  };

  const handleMobileNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 15);
    let formattedValue = digits;

    if (digits.length === 11 && digits.startsWith('1')) {
      formattedValue = `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    } else if (digits.length > 6) {
      formattedValue = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (digits.length > 3) {
      formattedValue = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    }

    form.setValue('mobileNumber', formattedValue, { shouldValidate: true });
  };


  return (
    <div className="max-w-2xl mx-auto">
        <div className="mb-6 flex justify-between items-center">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">{isEditing ? 'Edit Student' : 'Add New Student'}</h1>
                <p className="text-muted-foreground">
                    {isEditing ? 'Update the details for this student.' : 'Enter the details for the new student.'}
                </p>
            </div>
            <div>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept="image/*,.heic,.heif,.pdf,application/pdf"
              />
              {scannedAvatarUrl && (
                <div className="mb-2 flex justify-end">
                  <img
                    src={scannedAvatarUrl}
                    alt="Student face thumbnail"
                    className="h-12 w-12 rounded-full border object-cover shadow-sm"
                  />
                </div>
              )}
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isScanning}>
                {isScanning ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="mr-2 h-4 w-4" />
                )}
                Scan License
              </Button>
              {scannedLicenseUrl && (
                <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold">
                    <FileImage className="h-3.5 w-3.5" />
                    License image saved
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button type="button" size="sm" variant="outline" className="h-8 bg-white/70 px-2 text-xs dark:bg-background/70" onClick={handleViewSavedLicense}>
                      <Eye className="mr-1.5 h-3.5 w-3.5" />
                      View
                    </Button>
                    <Button type="button" size="sm" variant="outline" className="h-8 bg-white/70 px-2 text-xs dark:bg-background/70" onClick={handleDownloadSavedLicense}>
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      Download
                    </Button>
                  </div>
                  {isUploadingLicense && (
                    <p className="mt-2 text-[11px] text-emerald-800 dark:text-emerald-200">
                      Uploading {Math.round(licenseUploadProgress)}%
                    </p>
                  )}
                </div>
              )}
            </div>
        </div>

        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                {!isAuthReady && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Firebase is still connecting</AlertTitle>
                    <AlertDescription>
                      {isUserLoading
                        ? 'Please wait a moment before saving this student.'
                        : 'Student saves are blocked until Firebase sign-in is available for this website.'}
                    </AlertDescription>
                  </Alert>
                )}
                <Card>
                    <CardContent className="p-6 space-y-6">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Full Name</FormLabel>
                                <FormControl>
                                    <Input placeholder="John Doe" {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="address"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Address</FormLabel>
                                <FormControl>
                                    <Input placeholder="123 Main St, Anytown, USA" {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="mobileNumber"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Mobile Number</FormLabel>
                                <FormControl>
                                    <Input
                                        type="tel"
                                        inputMode="tel"
                                        autoComplete="tel"
                                        placeholder="(416) 555-1234"
                                        {...field}
                                        onChange={handleMobileNumberChange}
                                    />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="birthdate"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Birthdate</FormLabel>
                                <FormControl>
                                    <Input type="date" {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="licenseNumber"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>License Number</FormLabel>
                                <FormControl>
                                    <Input 
                                        placeholder="A1234-56789-12345" 
                                        {...field}
                                        onChange={handleLicenseNumberChange}
                                    />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                            control={form.control}
                            name="licenseExpiry"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>License Expiry</FormLabel>
                                <FormControl>
                                    <Input type="date" {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                            <FormField
                            control={form.control}
                            name="licenseType"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>License Type</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                    <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                    <SelectItem value="G2">G2</SelectItem>
                                    <SelectItem value="G">G</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                        </div>
                            <FormField
                            control={form.control}
                            name="comments"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Comments</FormLabel>
                                <FormControl>
                                    <Textarea placeholder="Any notes about the student..." {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />

                        {!isEditing && (
                          <div className="flex items-center space-x-2 rounded-lg border bg-blue-50/50 dark:bg-blue-900/10 px-4 py-3 shadow-sm">
                            <Checkbox 
                                id="sendWelcomeSms" 
                                checked={sendWelcomeSms} 
                                onCheckedChange={(checked) => setSendWelcomeSms(checked as boolean)} 
                            />
                            <div className="space-y-1 leading-none">
                              <label htmlFor="sendWelcomeSms" className="text-sm font-medium leading-none cursor-pointer">
                                Send Welcome SMS
                              </label>
                              <p className="text-sm text-muted-foreground">
                                Automatically text the student a welcome message.
                              </p>
                            </div>
                          </div>
                        )}
                    </CardContent>
                </Card>

                <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={() => onCancel ? onCancel() : router.back()}>Cancel</Button>
                    <Button type="submit" disabled={form.formState.isSubmitting || !isAuthReady}>
                        {form.formState.isSubmitting ? 'Saving...' : 'Save Student'}
                    </Button>
                </div>
            </form>
        </Form>

        <MissingPhoneDialog
          isOpen={!!missingPhoneStudent}
          student={missingPhoneStudent}
          onCancel={() => {
            setMissingPhoneStudent(null);
            router.push('/students');
          }}
          onSuccess={async (updatedStudent) => {
            setMissingPhoneStudent(null);
            await sendWelcomeSmsMessage(updatedStudent.mobileNumber, updatedStudent.name);
            if (onSuccess) onSuccess(updatedStudent);
            else router.push('/students');
          }}
        />
        <LicenseImagePreviewDialog
          isOpen={isLicensePreviewOpen}
          onOpenChange={setIsLicensePreviewOpen}
          imageUrl={scannedLicenseUrl}
          studentName={form.getValues('name') || student?.name}
          onDownload={handleDownloadSavedLicense}
        />
    </div>
  );
}
