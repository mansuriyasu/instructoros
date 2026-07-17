'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ArrowLeft, ChevronDown, Download, Mail, MessageCircle, Save, ShieldAlert, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useEvents } from '@/hooks/use-events';
import { useStudents } from '@/hooks/use-students';
import { useSession, useUser } from '@/firebase';
import { useFirestore, useTenantCollectionPath } from '@/firebase';
import { addDoc, collection } from 'firebase/firestore';
import { getAuthenticatedHeaders } from '@/lib/authenticated-fetch';
import type { CalendarEvent, EvaluationItem, EvaluationItemStatus, EvaluationTestType } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useEvaluations } from '@/hooks/use-evaluations';

const baseManeuvers = [
  ['start-pull-out', 'Start & pull out'], ['backing-up', 'Backing up'], ['driving-along', 'Driving along'],
  ['following-distance', 'Following distance'], ['lane-change', 'Lane change'], ['curves', 'Curves'],
  ['stopping-intersection', 'Stopping at intersection'], ['through-intersection', 'Through intersection'],
  ['railroad-crossing', 'Railroad crossing'], ['left-turns', 'Left turns'], ['right-turns', 'Right turns'],
];
const g2Only = [['roadside-stop', 'Roadside stop'], ['three-point-turn', '3-point turn'], ['parallel-parking', 'Parallel parking']];
const freeway = [['freeway-entering', 'Freeway entering'], ['freeway-driving', 'Freeway driving along'], ['freeway-lane-change', 'Freeway lane change'], ['freeway-exiting', 'Freeway exiting']];
const faultTags = ['No signal', 'No mirror', 'No blind spot', 'Speed too high', 'Speed too low', 'Poor lane position', 'Late/hesitant', 'Too wide/cut corner', 'Rolled the stop', 'Failed to yield'];
const autofailOptions = ['Dangerous action', 'Collision/mounted curb', 'Instructor took control', 'Stopped/rolled on railway tracks', "Didn't follow instruction"];

const verdictText = { pass: 'Would likely pass', borderline: 'Borderline', fail: 'Would not pass' } as const;
const statusSequence: EvaluationItemStatus[] = ['ok', 'minor', 'major'];

function getManeuvers(testType: EvaluationTestType) {
  const source = testType === 'G' ? [...baseManeuvers, ...freeway] : [...baseManeuvers, ...g2Only, ...freeway];
  return source.map(([id, name]) => ({ id, name, status: 'ok' as EvaluationItemStatus, tags: [] }));
}

function calculateVerdict(items: EvaluationItem[], autofails: string[]) {
  const minors = items.filter(item => item.status === 'minor').length;
  const majors = items.filter(item => item.status === 'major').length;
  if (autofails.length || majors >= 2 || (majors >= 1 && minors >= 4)) return { verdict: 'fail' as const, minors, majors };
  if (majors >= 1 || minors >= 4) return { verdict: 'borderline' as const, minors, majors };
  return { verdict: 'pass' as const, minors, majors };
}

function safeFileName(value: string) {
  return value.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'student';
}

function createEvaluationPdf(evaluation: { studentName: string; lesson: CalendarEvent; date: string; area: string; instructor: string; testType: EvaluationTestType; items: EvaluationItem[]; autofails: string[]; notes: string; verdict: 'pass' | 'borderline' | 'fail' }, tenant: any) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const gold: [number, number, number] = [212, 175, 55];
  doc.setFillColor(11, 11, 13); doc.rect(0, 0, width, 34, 'F');
  doc.setTextColor(255, 255, 255); doc.setFontSize(20); doc.setFont('helvetica', 'bold');
  doc.text(tenant?.receiptBusinessName || tenant?.name || 'InstructorOS', 15, 16);
  doc.setFontSize(9); doc.setTextColor(...gold); doc.text('MOCK ROAD-TEST EVALUATION', 15, 24);
  doc.setTextColor(30, 30, 30); doc.setFontSize(13); doc.text(evaluation.studentName, 15, 48);
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.text(`Test: ${evaluation.testType}   Date: ${evaluation.date}   Instructor: ${evaluation.instructor}`, 15, 56);
  doc.text(`Lesson: ${format(new Date(evaluation.lesson.start), 'MMM d, yyyy h:mm a')}   Area/route: ${evaluation.area || 'Not provided'}`, 15, 63);
  const verdictColor = evaluation.verdict === 'pass' ? [22, 128, 75] : evaluation.verdict === 'borderline' ? [177, 117, 0] : [180, 35, 35];
  doc.setFillColor(...verdictColor as [number, number, number]); doc.roundedRect(15, 70, width - 30, 16, 3, 3, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text(verdictText[evaluation.verdict], width / 2, 80, { align: 'center' });
  doc.setTextColor(40, 40, 40); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  const tableRows = evaluation.items.map(item => [item.name, item.status.toUpperCase(), item.tags.join(', ') || '—']);
  autoTable(doc, { startY: 94, head: [['Maneuver', 'Result', 'Fault tags']], body: tableRows, theme: 'grid', headStyles: { fillColor: [11, 11, 13], textColor: [255, 255, 255] }, styles: { fontSize: 8, cellPadding: 2.5 } });
  let y = ((doc as any).lastAutoTable?.finalY || 94) + 10;
  doc.setFont('helvetica', 'bold'); doc.text(`Minor: ${evaluation.items.filter(item => item.status === 'minor').length}   Major: ${evaluation.items.filter(item => item.status === 'major').length}`, 15, y); y += 7;
  if (evaluation.autofails.length) { doc.text('Automatic fail triggers', 15, y); y += 5; doc.setFont('helvetica', 'normal'); doc.text(evaluation.autofails.join(', '), 15, y, { maxWidth: width - 30 }); y += 10; }
  doc.setFont('helvetica', 'bold'); doc.text('Practise before booking', 15, y); y += 5; doc.setFont('helvetica', 'normal'); doc.text(evaluation.notes || 'No notes added.', 15, y, { maxWidth: width - 30 });
  doc.setFontSize(8); doc.setTextColor(90, 90, 90); doc.text('Instructor estimate only. This is not an official Ontario DriveTest score. DriveTest does not publish point values.', 15, height - 22, { maxWidth: width - 30 });
  doc.text('SparkOn practice assessment — not an official Ontario DriveTest score. @sparkondrive · linktr.ee/sparkondrive', 15, height - 13, { maxWidth: width - 30 });
  return doc;
}

export default function EvaluationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lessonId = searchParams.get('lessonId') || '';
  const { events, loading: eventsLoading } = useEvents();
  const { students, loading: studentsLoading } = useStudents();
  const { activeTenantId, tenant, user } = useSession();
  const firestore = useFirestore();
  const evaluationsPath = useTenantCollectionPath('evaluations');
  const { user: authUser } = useUser();
  const { toast } = useToast();
  const { evaluations: existingEvaluations } = useEvaluations(undefined, lessonId);
  const lesson = useMemo(() => events?.find(event => event.id === lessonId), [events, lessonId]);
  const student = useMemo(() => students?.find(item => item.id === lesson?.studentId), [lesson?.studentId, students]);
  const [testType, setTestType] = useState<EvaluationTestType>('G2');
  const [items, setItems] = useState<EvaluationItem[]>(() => getManeuvers('G2'));
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [autofails, setAutofails] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedEvaluation, setSavedEvaluation] = useState<any>(null);
  const result = useMemo(() => calculateVerdict(items, autofails), [autofails, items]);

  useEffect(() => {
    const existing = existingEvaluations[0];
    if (!existing || savedEvaluation) return;
    setTestType(existing.testType);
    setItems(existing.items);
    setAutofails(existing.autofails || []);
    setNotes(existing.notes || '');
    setSavedEvaluation(existing);
  }, [existingEvaluations, savedEvaluation]);

  const switchTestType = (next: EvaluationTestType) => { setTestType(next); setItems(getManeuvers(next)); setOpenItem(null); };
  const cycleStatus = (id: string) => setItems(current => current.map(item => item.id === id ? { ...item, status: statusSequence[(statusSequence.indexOf(item.status) + 1) % statusSequence.length] } : item));
  const toggleTag = (id: string, tag: string) => setItems(current => current.map(item => {
    if (item.id !== id) return item;
    const tags = item.tags.includes(tag) ? item.tags.filter(value => value !== tag) : [...item.tags, tag];
    return { ...item, tags, status: tags.length && item.status === 'ok' ? 'minor' : item.status };
  }));
  const toggleAutofail = (value: string) => setAutofails(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value]);

  const makePdf = () => savedEvaluation && lesson && student ? createEvaluationPdf({ ...savedEvaluation, studentName: student.name, lesson }, tenant) : null;
  const downloadPdf = () => { const pdf = makePdf(); if (!pdf || !student) return; pdf.save(`sparkon-evaluation-${safeFileName(student.name)}-${savedEvaluation.date}.pdf`); };
  const sharePdf = async () => {
    const pdf = makePdf(); if (!pdf || !student) return;
    const blob = pdf.output('blob');
    if (navigator.share && navigator.canShare?.({ files: [new File([blob], 'evaluation.pdf', { type: 'application/pdf' })] })) {
      await navigator.share({ title: `Road-test evaluation for ${student.name}`, files: [new File([blob], 'evaluation.pdf', { type: 'application/pdf' })] });
    } else { downloadPdf(); toast({ title: 'PDF downloaded', description: 'Your device does not support file sharing from this browser.' }); }
  };
  const openContact = (channel: 'email' | 'text' | 'whatsapp') => {
    if (!student || !savedEvaluation) return;
    const message = `Hi ${student.name}, your ${savedEvaluation.testType} mock road-test evaluation is ready. Result: ${verdictText[savedEvaluation.verdict as keyof typeof verdictText]}. This is an instructor estimate, not an official DriveTest score.`;
    if (channel === 'email' && student.email) window.location.href = `mailto:${student.email}?subject=${encodeURIComponent('Mock road-test evaluation')}&body=${encodeURIComponent(message)}`;
    if (channel === 'text' && student.mobileNumber) window.location.href = `sms:${student.mobileNumber}?body=${encodeURIComponent(message)}`;
    if (channel === 'whatsapp' && student.mobileNumber) window.open(`https://api.whatsapp.com/send?phone=${student.mobileNumber.replace(/\D/g, '')}&text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
    downloadPdf();
  };
  const save = async () => {
    if (!activeTenantId || !lesson || !student || !authUser) {
      toast({ variant: 'destructive', title: 'Workspace is not ready', description: 'Please wait for your workspace to finish loading, then try again.' });
      return;
    }
    setIsSaving(true);
    try {
      const payload = { tenantId: activeTenantId, studentId: student.id, lessonId: lesson.id, testType, date: savedEvaluation?.date || new Date().toISOString(), area: lesson.studentAddress || lesson.examCenter || lesson.notes || '', instructor: user?.displayName || authUser.displayName || authUser.email || '', items, minor_count: result.minors, major_count: result.majors, autofails, verdict: result.verdict, notes };
      const response = await fetch(savedEvaluation?.id ? `/api/evaluations/${savedEvaluation.id}` : '/api/evaluations', { method: savedEvaluation?.id ? 'PATCH' : 'POST', headers: { ...(await getAuthenticatedHeaders()), 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const serverError = String(data.error || '');
        const canUseClientFallback = !savedEvaluation?.id && (response.status === 404 || /default credentials|service account|firebase admin|could not load default/i.test(serverError));
        if (!canUseClientFallback || !firestore || !evaluationsPath) throw new Error(serverError || 'Could not save evaluation.');
        const directRecord = { ...payload, instructorUid: authUser.uid, createdByUid: authUser.uid, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        const directRef = await addDoc(collection(firestore, evaluationsPath), directRecord);
        setSavedEvaluation({ ...directRecord, id: directRef.id });
        toast({ title: 'Evaluation saved', description: 'Saved through your secure Firebase workspace connection.' });
        return;
      }
      setSavedEvaluation({ ...(savedEvaluation || {}), ...payload, ...(data.evaluation || {}), id: savedEvaluation?.id || data.evaluation?.id }); toast({ title: savedEvaluation?.id ? 'Evaluation updated' : 'Evaluation saved', description: 'The assessment is now available in the student history.' });
    } catch (error) { toast({ variant: 'destructive', title: 'Could not save evaluation', description: error instanceof Error ? error.message : 'Please try again.' }); } finally { setIsSaving(false); }
  };

  if (eventsLoading || studentsLoading) return <div className="mx-auto w-full max-w-2xl rounded-2xl border bg-card p-8 text-center"><p className="font-semibold">Loading scheduled lesson…</p></div>;
  if (!lessonId || !lesson || !student) return <div className="mx-auto w-full max-w-2xl rounded-2xl border bg-card p-8 text-center"><h1 className="text-xl font-bold">Scheduled lesson not found</h1><p className="mt-2 text-sm text-muted-foreground">Open Evaluate from a scheduled student lesson.</p><Button className="mt-5" onClick={() => router.push('/app/schedule')}><ArrowLeft className="mr-2 h-4 w-4" />Back to Schedule</Button></div>;

  return <div className="mx-auto w-full max-w-2xl pb-28">
    <div className="mb-4 flex items-center gap-3"><Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Back"><ArrowLeft /></Button><div><p className="text-xs font-bold uppercase tracking-wide text-[#A47C08]">In-car assessment</p><h1 className="text-2xl font-black">{student.name}</h1></div></div>
    <div className="rounded-2xl bg-[#0b0b0d] p-4 text-white shadow-lg"><p className="text-sm text-white/70">Instructor estimate only. Not an official Ontario DriveTest score.</p><div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-white/10 p-1"><button type="button" onClick={() => switchTestType('G2')} className={cn('min-h-12 rounded-lg text-base font-black', testType === 'G2' ? 'bg-[#d4af37] text-[#0b0b0d]' : 'text-white')}>G2 · City</button><button type="button" onClick={() => switchTestType('G')} className={cn('min-h-12 rounded-lg text-base font-black', testType === 'G' ? 'bg-[#d4af37] text-[#0b0b0d]' : 'text-white')}>G · Full/highway</button></div><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><span className="text-white/60">Lesson</span><p className="font-semibold">{format(new Date(lesson.start), 'MMM d, yyyy h:mm a')}</p></div><div><span className="text-white/60">Area / route</span><p className="truncate font-semibold">{lesson.studentAddress || lesson.examCenter || lesson.notes || 'Not provided'}</p></div></div></div>
    <div className="mt-5 rounded-2xl border bg-card p-4"><div className="mb-3 flex items-center justify-between"><div><h2 className="text-lg font-black">Maneuvers</h2><p className="text-xs text-muted-foreground">Tap a result to cycle OK, Minor, and Major.</p></div><ShieldAlert className="h-5 w-5 text-[#d4af37]" /></div><div className="divide-y">{items.map(item => <div key={item.id} className="py-3"><div className="flex items-center gap-2"><button type="button" onClick={() => setOpenItem(openItem === item.id ? null : item.id)} className="flex min-h-12 min-w-0 flex-1 items-center gap-2 text-left font-semibold"><ChevronDown className={cn('h-5 w-5 transition-transform', openItem === item.id && 'rotate-180')} /><span className="truncate">{item.name}</span></button><button type="button" onClick={() => cycleStatus(item.id)} className={cn('min-h-12 min-w-24 rounded-xl px-3 text-sm font-black', item.status === 'ok' ? 'bg-emerald-100 text-emerald-800' : item.status === 'minor' ? 'bg-amber-100 text-amber-900' : 'bg-red-100 text-red-800')}>{item.status === 'ok' ? 'OK' : item.status === 'minor' ? 'Minor' : 'Major'}</button></div>{openItem === item.id && <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-muted/40 p-3">{faultTags.map(tag => <label key={tag} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={item.tags.includes(tag)} onChange={() => toggleTag(item.id, tag)} className="h-5 w-5 accent-[#d4af37]" />{tag}</label>)}</div>}</div>)}</div></div>
    <div className="mt-5 rounded-2xl border bg-card p-4"><h2 className="text-lg font-black">Automatic fail</h2><p className="mb-3 text-xs text-muted-foreground">Selecting any one makes the estimate a fail.</p><div className="space-y-2">{autofailOptions.map(value => <label key={value} className="flex min-h-12 items-center justify-between rounded-xl border px-3 text-sm font-semibold"><span>{value}</span><Switch checked={autofails.includes(value)} onCheckedChange={() => toggleAutofail(value)} /></label>)}</div></div>
    <div className="mt-5 rounded-2xl border bg-card p-4"><label className="text-lg font-black" htmlFor="practice-notes">Practise before booking</label><Textarea id="practice-notes" value={notes} onChange={event => setNotes(event.target.value)} placeholder="What should the student practise next?" className="mt-3 min-h-28" /></div>
    <div className="mt-5 rounded-2xl border border-[#d4af37]/50 bg-[#fff9e7] p-4"><p className="text-xs font-bold uppercase tracking-wide text-[#806000]">Live estimate</p><div className="mt-1 flex items-end justify-between gap-3"><p className="text-2xl font-black text-[#0b0b0d]">{verdictText[result.verdict]}</p><p className="text-right text-sm font-bold text-[#0b0b0d]">{result.minors} minor · {result.majors} major</p></div></div>
    <div className="mt-5 flex flex-wrap gap-2"><Button onClick={save} disabled={isSaving} className="min-h-12 flex-1 bg-[#d4af37] font-black text-[#0b0b0d] hover:bg-[#e5c65c]"><Save className="mr-2 h-5 w-5" />{isSaving ? 'Saving…' : savedEvaluation?.id ? 'Save changes' : 'Save evaluation'}</Button>{savedEvaluation && <><Button onClick={downloadPdf} className="min-h-12 bg-[#0b0b0d] font-bold"><Download className="mr-2 h-4 w-4" />Download PDF</Button><Button onClick={sharePdf} variant="outline" className="min-h-12"><Share2 className="mr-2 h-4 w-4" />Share PDF</Button>{student.email && <Button onClick={() => openContact('email')} variant="outline" className="min-h-12"><Mail className="mr-2 h-4 w-4" />Email</Button>}{student.mobileNumber && <><Button onClick={() => openContact('text')} variant="outline" className="min-h-12"><MessageCircle className="mr-2 h-4 w-4" />Text</Button><Button onClick={() => openContact('whatsapp')} variant="outline" className="min-h-12"><MessageCircle className="mr-2 h-4 w-4" />WhatsApp</Button></>}</>}</div>
    {savedEvaluation && <p className="mt-3 text-center text-xs text-muted-foreground">Saved. The PDF and contact actions use the latest assessment.</p>}
  </div>;
}
