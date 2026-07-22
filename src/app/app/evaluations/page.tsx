'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ArrowLeft, Check, ChevronDown, Download, Mail, MessageCircle, Plus, Save, Share2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useEvents } from '@/hooks/use-events';
import { useStudents } from '@/hooks/use-students';
import { useSession, useUser } from '@/firebase';
import { useFirestore, useTenantCollectionPath } from '@/firebase';
import { addDoc, collection } from 'firebase/firestore';
import { getAuthenticatedHeaders } from '@/lib/authenticated-fetch';
import type { CalendarEvent, EvaluationIntervention, EvaluationItem, EvaluationMark, EvaluationTestType } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useEvaluations } from '@/hooks/use-evaluations';
import { deriveItemStatus } from '@/lib/evaluation-criteria';
import { buildSheetItems, getExamSheet, getExamSheetByVersion, type ExamSheet, type SheetItem } from '@/lib/evaluation-sheets';

const TEST_LABELS: Record<EvaluationTestType, string> = { G2: 'Record of G2 Examination', G: 'Record of G Examination' };
const outcomeText: Record<string, string> = { meets: 'Meets Ministry Standards', 'does-not-meet': 'Does Not Meet Ministry Standards' };

function safeFileName(value: string) {
  return value.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'student';
}

function markLabel(mark: EvaluationMark) {
  const symbol = mark.severity === 'major' ? '✗' : '✓';
  return `${mark.code ? mark.code : ''}${symbol}`;
}

interface SheetState {
  items: EvaluationItem[];
  sectionStatus: Record<string, 'ok' | 'not-completed'>;
  outcome?: 'meets' | 'does-not-meet';
  summaryReasons: string[];
  improperUseOf: string[];
  examinerFlags: string[];
  interventions: EvaluationIntervention[];
  notes: string;
}

function freshSheetState(sheet: ExamSheet): SheetState {
  return {
    items: buildSheetItems(sheet),
    sectionStatus: {},
    outcome: undefined,
    summaryReasons: [],
    improperUseOf: [],
    examinerFlags: [],
    interventions: [],
    notes: '',
  };
}

// ── PDF: faithful to the DriveTest sheet layout ─────────────────────────────

function createSheetPdf(
  data: { studentName: string; lesson: CalendarEvent; date: string; area: string; instructor: string; testType: EvaluationTestType },
  sheet: ExamSheet,
  state: SheetState,
  tenant: any
) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const gold: [number, number, number] = [212, 175, 55];
  const ink: [number, number, number] = [11, 11, 13];
  const businessName = tenant?.receiptBusinessName || tenant?.name || 'InstructorOS';

  doc.setFillColor(...ink); doc.rect(0, 0, width, 30, 'F');
  doc.setTextColor(255, 255, 255); doc.setFontSize(16); doc.setFont('helvetica', 'bold');
  doc.text(businessName, 15, 14);
  doc.setFontSize(9); doc.setTextColor(...gold); doc.text(TEST_LABELS[data.testType].toUpperCase(), 15, 22);
  doc.setTextColor(30, 30, 30); doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.text(data.studentName, 15, 40);
  doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${data.date}   Instructor: ${data.instructor}`, 15, 46);
  doc.text(`Lesson: ${format(new Date(data.lesson.start), 'MMM d, yyyy h:mm a')}   Area/route: ${data.area || 'Not provided'}`, 15, 51);

  // Outcome banner
  const meets = state.outcome === 'meets';
  const outcomeColor: [number, number, number] = state.outcome === 'meets' ? [22, 128, 75] : state.outcome === 'does-not-meet' ? [180, 35, 35] : [120, 120, 120];
  doc.setFillColor(...outcomeColor); doc.roundedRect(15, 55, width - 30, 12, 2, 2, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
  doc.text(state.outcome ? outcomeText[state.outcome] : 'Outcome not recorded', width / 2, 63, { align: 'center' });
  doc.setTextColor(40, 40, 40); doc.setFont('helvetica', 'normal');

  const marksById = new Map(state.items.map(item => [item.id, item.marks || []]));
  const rows: any[] = [];
  for (const section of sheet.sections) {
    const status = state.sectionStatus[section.id];
    const header = `${section.label}${status ? `   [${status === 'ok' ? 'OK' : 'Not Completed'}]` : ''}`;
    rows.push([{ content: header, colSpan: 2, styles: { fillColor: ink, textColor: gold, fontStyle: 'bold' as const } }]);
    for (const group of section.groups) {
      if (group.title) rows.push([{ content: group.title, colSpan: 2, styles: { fillColor: [235, 235, 235] as [number, number, number], fontStyle: 'italic' as const } }]);
      for (const item of group.items) {
        const marks = marksById.get(item.id) || [];
        const codeText = item.codes.map(cc => (cc.code ? `${cc.code}_${cc.label}` : cc.label)).join(' / ');
        const line = [item.number, item.label, codeText].filter(Boolean).join('. ').replace('.  ', '. ');
        const marksText = marks.length ? marks.map(m => `${m.lane ? m.lane + ':' : ''}${markLabel(m)}`).join('  ') : '';
        rows.push([`${line}`, marksText]);
      }
    }
  }
  autoTable(doc, {
    startY: 71,
    head: [['Item', 'Marks']],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: ink, textColor: [255, 255, 255] },
    styles: { fontSize: 6.5, cellPadding: 1.5, valign: 'middle' },
    columnStyles: { 0: { cellWidth: width - 30 - 26 }, 1: { cellWidth: 26, fontStyle: 'bold' } },
    margin: { left: 15, right: 15 },
  });

  let y = ((doc as any).lastAutoTable?.finalY || 71) + 6;
  const ensureSpace = (needed: number) => { if (y + needed > height - 20) { doc.addPage(); y = 20; } };
  const writeList = (title: string, values: string[]) => {
    if (!values.length) return;
    ensureSpace(10);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text(title, 15, y); y += 4;
    doc.setFont('helvetica', 'normal'); doc.text(values.join(' · '), 15, y, { maxWidth: width - 30 }); y += 6;
  };
  writeList(sheet.summaryReasonsLabel, state.summaryReasons);
  if (sheet.improperUseOf?.length) writeList('Improper Use Of', state.improperUseOf);
  if (sheet.examinerFlags?.length) writeList('Examiner flags', state.examinerFlags);
  if (state.interventions.length) {
    ensureSpace(10);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text('Examiner comments', 15, y); y += 2;
    autoTable(doc, {
      startY: y,
      head: [['Time', 'Intervention', 'Violation', 'Description']],
      body: state.interventions.map(i => [i.time, i.intervention, i.violation, i.description]),
      theme: 'grid', headStyles: { fillColor: ink, textColor: [255, 255, 255] }, styles: { fontSize: 7, cellPadding: 1.5 }, margin: { left: 15, right: 15 },
    });
    y = ((doc as any).lastAutoTable?.finalY || y) + 6;
  }
  if (state.notes) { ensureSpace(12); doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text('Notes', 15, y); y += 4; doc.setFont('helvetica', 'normal'); doc.text(state.notes, 15, y, { maxWidth: width - 30 }); y += 6; }

  doc.setFontSize(7); doc.setTextColor(90, 90, 90);
  doc.text(sheet.legend, 15, height - 20, { maxWidth: width - 30 });
  doc.text('Instructor practice assessment — not an official Ontario DriveTest score.', 15, height - 13, { maxWidth: width - 30 });
  doc.text(`${businessName}${tenant?.receiptFooterText ? ` — ${tenant.receiptFooterText}` : ''}`, 15, height - 8, { maxWidth: width - 30 });
  void meets;
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
  const { evaluations: existingEvaluations, loading: evaluationsLoading } = useEvaluations(undefined, lessonId);
  const lesson = useMemo(() => events?.find(event => event.id === lessonId), [events, lessonId]);
  const student = useMemo(() => students?.find(item => item.id === lesson?.studentId), [lesson?.studentId, students]);

  const [testType, setTestType] = useState<EvaluationTestType>('G2');
  const sheet = useMemo(() => getExamSheet(testType), [testType]);
  const [state, setState] = useState<SheetState>(() => freshSheetState(getExamSheet('G2')));
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [openLane, setOpenLane] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedEvaluation, setSavedEvaluation] = useState<any>(null);
  const loadedRef = useRef(false);

  // The most recent record for this lesson written in the official-sheet format.
  const sheetRecord = useMemo(
    () => existingEvaluations.find(e => e.sheetVersion || e.items?.some((i: EvaluationItem) => i.marks)),
    [existingEvaluations]
  );
  // An older tag-format record (if any) is shown read-only; the sheet stays editable.
  const legacyRecord = useMemo(
    () => existingEvaluations.find(e => !e.sheetVersion && !e.items?.some((i: EvaluationItem) => i.marks)),
    [existingEvaluations]
  );

  const liveCounts = useMemo(() => {
    let minors = 0, majors = 0;
    for (const item of state.items) {
      const status = deriveItemStatus(item.marks);
      if (status === 'major') majors += 1;
      else if (status === 'minor') minors += 1;
    }
    return { minors, majors };
  }, [state.items]);

  // Load an existing sheet record, or preselect the test type from the student.
  useEffect(() => {
    if (loadedRef.current || evaluationsLoading) return;
    if (sheetRecord) {
      loadedRef.current = true;
      const loadedSheet = getExamSheetByVersion(sheetRecord.sheetVersion) || getExamSheet(sheetRecord.testType);
      setTestType(sheetRecord.testType);
      setState({
        items: (sheetRecord.items || []).map((i: EvaluationItem) => ({ ...i, marks: i.marks || [] })),
        sectionStatus: sheetRecord.sectionStatus || {},
        outcome: sheetRecord.outcome,
        summaryReasons: sheetRecord.summaryReasons || [],
        improperUseOf: sheetRecord.improperUseOf || [],
        examinerFlags: sheetRecord.examinerFlags || [],
        interventions: sheetRecord.interventions || [],
        notes: sheetRecord.notes || '',
      });
      setSavedEvaluation(sheetRecord);
      void loadedSheet;
      return;
    }
    if (existingEvaluations.length === 0 && student?.licenseType && student.licenseType !== testType) {
      loadedRef.current = true;
      setTestType(student.licenseType);
      setState(freshSheetState(getExamSheet(student.licenseType)));
    }
  }, [evaluationsLoading, sheetRecord, existingEvaluations.length, student?.licenseType, testType]);

  const switchTestType = (next: EvaluationTestType) => {
    if (savedEvaluation) return; // don't switch an already-saved record's sheet
    setTestType(next);
    setState(freshSheetState(getExamSheet(next)));
    setOpenItem(null);
    setOpenLane('');
  };

  const addMark = (itemId: string, code: string, severity: 'minor' | 'major', lane?: string) => {
    setState(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.id === itemId
          ? { ...item, marks: [...(item.marks || []), { code, severity, ...(lane ? { lane } : {}) }] }
          : item
      ),
    }));
  };
  const removeMark = (itemId: string, index: number) => {
    setState(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.id === itemId ? { ...item, marks: (item.marks || []).filter((_, i) => i !== index) } : item
      ),
    }));
  };
  const toggleSectionStatus = (sectionId: string, value: 'ok' | 'not-completed') => {
    setState(prev => {
      const next = { ...prev.sectionStatus };
      if (next[sectionId] === value) delete next[sectionId];
      else next[sectionId] = value;
      return { ...prev, sectionStatus: next };
    });
  };
  const toggleInList = (key: 'summaryReasons' | 'improperUseOf' | 'examinerFlags', value: string) => {
    setState(prev => ({
      ...prev,
      [key]: prev[key].includes(value) ? prev[key].filter(v => v !== value) : [...prev[key], value],
    }));
  };
  const addIntervention = () => setState(prev => ({
    ...prev,
    interventions: [...prev.interventions, { time: format(new Date(), 'HH:mm'), intervention: '', violation: '', description: '' }],
  }));
  const updateIntervention = (index: number, field: keyof EvaluationIntervention, value: string) => setState(prev => ({
    ...prev,
    interventions: prev.interventions.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry)),
  }));
  const removeIntervention = (index: number) => setState(prev => ({
    ...prev,
    interventions: prev.interventions.filter((_, i) => i !== index),
  }));

  const outcomeVerdict = state.outcome === 'meets' ? 'pass' : state.outcome === 'does-not-meet' ? 'fail' : 'borderline';

  const makePdf = () => savedEvaluation && lesson && student
    ? createSheetPdf({ studentName: student.name, lesson, date: savedEvaluation.date, area: savedEvaluation.area || '', instructor: savedEvaluation.instructor || '', testType }, getExamSheetByVersion(savedEvaluation.sheetVersion) || sheet, {
        items: savedEvaluation.items || [], sectionStatus: savedEvaluation.sectionStatus || {}, outcome: savedEvaluation.outcome,
        summaryReasons: savedEvaluation.summaryReasons || [], improperUseOf: savedEvaluation.improperUseOf || [],
        examinerFlags: savedEvaluation.examinerFlags || [], interventions: savedEvaluation.interventions || [], notes: savedEvaluation.notes || '',
      }, tenant)
    : null;
  const downloadPdf = () => { const pdf = makePdf(); if (!pdf || !student) return; pdf.save(`${safeFileName(tenant?.receiptBusinessName || tenant?.name || 'instructoros')}-${testType}-evaluation-${safeFileName(student.name)}-${savedEvaluation.date}.pdf`); };
  const sharePdf = async () => {
    const pdf = makePdf(); if (!pdf || !student) return;
    const blob = pdf.output('blob');
    if (navigator.share && navigator.canShare?.({ files: [new File([blob], 'evaluation.pdf', { type: 'application/pdf' })] })) {
      await navigator.share({ title: `Road-test evaluation for ${student.name}`, files: [new File([blob], 'evaluation.pdf', { type: 'application/pdf' })] });
    } else { downloadPdf(); toast({ title: 'PDF downloaded', description: 'Your device does not support file sharing from this browser.' }); }
  };
  const openContact = (channel: 'email' | 'text' | 'whatsapp') => {
    if (!student || !savedEvaluation) return;
    const result = savedEvaluation.outcome ? outcomeText[savedEvaluation.outcome] : 'Assessment ready';
    const message = `Hi ${student.name}, your ${testType} mock road-test evaluation is ready. Result: ${result}. This is an instructor estimate, not an official DriveTest score.`;
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
      const items = state.items.map(item => ({ ...item, status: deriveItemStatus(item.marks) }));
      const payload = {
        tenantId: activeTenantId, studentId: student.id, lessonId: lesson.id, testType,
        date: savedEvaluation?.date || new Date().toISOString(),
        area: lesson.studentAddress || lesson.examCenter || lesson.notes || '',
        instructor: user?.displayName || authUser.displayName || authUser.email || '',
        items, autofails: [], notes: state.notes,
        sheetVersion: sheet.version, sectionStatus: state.sectionStatus, outcome: state.outcome,
        summaryReasons: state.summaryReasons, improperUseOf: state.improperUseOf,
        examinerFlags: state.examinerFlags, interventions: state.interventions,
        minor_count: liveCounts.minors, major_count: liveCounts.majors, verdict: outcomeVerdict,
      };
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
      setSavedEvaluation({ ...(savedEvaluation || {}), ...payload, ...(data.evaluation || {}), id: savedEvaluation?.id || data.evaluation?.id });
      toast({ title: savedEvaluation?.id ? 'Evaluation updated' : 'Evaluation saved', description: 'The assessment is now available in the student history.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Could not save evaluation', description: error instanceof Error ? error.message : 'Please try again.' });
    } finally { setIsSaving(false); }
  };

  if (eventsLoading || studentsLoading) return <div className="mx-auto w-full max-w-2xl rounded-2xl border bg-card p-8 text-center"><p className="font-semibold">Loading scheduled lesson…</p></div>;
  if (!lessonId || !lesson || !student) return <div className="mx-auto w-full max-w-2xl rounded-2xl border bg-card p-8 text-center"><h1 className="text-xl font-bold">Scheduled lesson not found</h1><p className="mt-2 text-sm text-muted-foreground">Open Evaluate from a scheduled student lesson.</p><Button className="mt-5" onClick={() => router.push('/app/schedule')}><ArrowLeft className="mr-2 h-4 w-4" />Back to Schedule</Button></div>;

  return <div className="mx-auto w-full max-w-3xl pb-28">
    <div className="mb-4 flex items-center gap-3">
      <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Back"><ArrowLeft /></Button>
      <div><p className="text-xs font-bold uppercase tracking-wide text-[#A47C08]">In-car assessment</p><h1 className="text-2xl font-black">{student.name}</h1></div>
    </div>

    <div className="rounded-2xl bg-[#0b0b0d] p-4 text-white shadow-lg">
      <p className="text-sm text-white/70">DriveTest examiner sheet replica. Instructor estimate — not an official DriveTest score.</p>
      <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-white/10 p-1">
        <button type="button" onClick={() => switchTestType('G2')} disabled={!!savedEvaluation} className={cn('min-h-12 rounded-lg text-base font-black disabled:opacity-60', testType === 'G2' ? 'bg-[#d4af37] text-[#0b0b0d]' : 'text-white')}>G2 · Record of G2</button>
        <button type="button" onClick={() => switchTestType('G')} disabled={!!savedEvaluation} className={cn('min-h-12 rounded-lg text-base font-black disabled:opacity-60', testType === 'G' ? 'bg-[#d4af37] text-[#0b0b0d]' : 'text-white')}>G · Record of G</button>
      </div>
      <p className="mt-2 text-xs text-white/50">{sheet.legend}</p>
    </div>

    {legacyRecord && (
      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        An earlier evaluation ({format(new Date(legacyRecord.date), 'MMM d, yyyy')}, {legacyRecord.verdict}) exists in the previous format. The official sheet below saves as a new record.
      </div>
    )}

    {sheet.sections.map(section => {
      const status = state.sectionStatus[section.id];
      return (
        <div key={section.id} className="mt-5 rounded-2xl border bg-card p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-black uppercase tracking-wide text-[#0b0b0d] dark:text-white">{section.label}</h2>
            <div className="flex gap-1.5">
              <button type="button" onClick={() => toggleSectionStatus(section.id, 'ok')} className={cn('rounded-lg px-2.5 py-1 text-xs font-bold', status === 'ok' ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground')}>OK</button>
              <button type="button" onClick={() => toggleSectionStatus(section.id, 'not-completed')} className={cn('rounded-lg px-2.5 py-1 text-xs font-bold', status === 'not-completed' ? 'bg-slate-700 text-white' : 'bg-muted text-muted-foreground')}>Not Completed</button>
            </div>
          </div>
          {section.groups.map(group => (
            <div key={group.id}>
              {group.title && <p className="mt-2 pb-1 text-xs font-black uppercase tracking-wide text-[#A47C08]">{group.title}</p>}
              <div className="divide-y">
                {group.items.map(item => {
                  const stateItem = state.items.find(si => si.id === item.id);
                  const marks = stateItem?.marks || [];
                  const isOpen = openItem === item.id;
                  const severity = deriveItemStatus(marks);
                  return (
                    <div key={item.id} className="py-2.5">
                      <button type="button" onClick={() => { setOpenItem(isOpen ? null : item.id); setOpenLane(section.lanes?.[0]?.id || ''); }} className="flex w-full items-start gap-2 text-left">
                        <ChevronDown className={cn('mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
                        <span className="min-w-0 flex-1">
                          <span className="text-sm font-semibold">{item.number}. {item.label}</span>
                          <span className="block text-xs text-muted-foreground">{item.codes.map(cc => (cc.code ? `${cc.code}_${cc.label}` : cc.label)).join(' / ')}</span>
                        </span>
                        <span className={cn('mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full', severity === 'major' ? 'bg-red-500' : severity === 'minor' ? 'bg-amber-500' : 'bg-transparent')} />
                      </button>
                      {marks.length > 0 && (
                        <div className="ml-6 mt-1.5 flex flex-wrap gap-1.5">
                          {marks.map((mark, index) => (
                            <button key={index} type="button" onClick={() => removeMark(item.id, index)} className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold', mark.severity === 'major' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-900')}>
                              {mark.lane ? `${mark.lane} ` : ''}{markLabel(mark)}<X className="h-3 w-3" />
                            </button>
                          ))}
                        </div>
                      )}
                      {isOpen && (
                        <div className="ml-6 mt-2 rounded-xl bg-muted/40 p-3">
                          {section.lanes && section.lanes.length > 0 && (
                            <div className="mb-2 flex flex-wrap gap-1.5">
                              {section.lanes.map(lane => (
                                <button key={lane.id} type="button" onClick={() => setOpenLane(lane.id)} className={cn('rounded-lg px-2.5 py-1 text-xs font-bold', openLane === lane.id ? 'bg-[#0b0b0d] text-white' : 'bg-background text-muted-foreground')}>{lane.label}</button>
                              ))}
                            </div>
                          )}
                          <div className="space-y-1.5">
                            {(item.codes.length ? item.codes : [{ code: '', label: item.label || 'Mark' }]).map(cc => (
                              <div key={cc.code || 'x'} className="flex items-center gap-2">
                                <span className="min-w-0 flex-1 text-xs font-medium">{cc.code ? `${cc.code}_${cc.label}` : cc.label}</span>
                                <button type="button" onClick={() => addMark(item.id, cc.code, 'minor', section.lanes ? openLane : undefined)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-900" aria-label="Mark check"><Check className="h-4 w-4" /></button>
                                <button type="button" onClick={() => addMark(item.id, cc.code, 'major', section.lanes ? openLane : undefined)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-red-800 font-black" aria-label="Mark X"><X className="h-4 w-4" /></button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      );
    })}

    <div className="mt-5 rounded-2xl border bg-card p-4">
      <h2 className="text-base font-black">Outcome</h2>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button type="button" onClick={() => setState(prev => ({ ...prev, outcome: prev.outcome === 'meets' ? undefined : 'meets' }))} className={cn('min-h-12 rounded-xl px-3 text-sm font-black', state.outcome === 'meets' ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground')}>Meets Ministry Standards</button>
        <button type="button" onClick={() => setState(prev => ({ ...prev, outcome: prev.outcome === 'does-not-meet' ? undefined : 'does-not-meet' }))} className={cn('min-h-12 rounded-xl px-3 text-sm font-black', state.outcome === 'does-not-meet' ? 'bg-red-600 text-white' : 'bg-muted text-muted-foreground')}>Does Not Meet Ministry Standards</button>
      </div>
    </div>

    <div className="mt-5 rounded-2xl border bg-card p-4">
      <h2 className="text-base font-black">{sheet.summaryReasonsLabel}</h2>
      <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {sheet.summaryReasons.map(reason => (
          <label key={reason} className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={state.summaryReasons.includes(reason)} onChange={() => toggleInList('summaryReasons', reason)} className="h-4 w-4 accent-[#d4af37]" />{reason}</label>
        ))}
      </div>
    </div>

    {sheet.improperUseOf?.length ? (
      <div className="mt-5 rounded-2xl border bg-card p-4">
        <h2 className="text-base font-black">Improper Use Of</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {sheet.improperUseOf.map(value => (
            <button key={value} type="button" onClick={() => toggleInList('improperUseOf', value)} className={cn('rounded-lg px-3 py-1.5 text-sm font-semibold', state.improperUseOf.includes(value) ? 'bg-[#0b0b0d] text-white' : 'bg-muted text-muted-foreground')}>{value}</button>
          ))}
        </div>
      </div>
    ) : null}

    {sheet.examinerFlags?.length ? (
      <div className="mt-5 rounded-2xl border bg-card p-4">
        <h2 className="text-base font-black">Examiner flags</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {sheet.examinerFlags.map(value => (
            <button key={value} type="button" onClick={() => toggleInList('examinerFlags', value)} className={cn('rounded-lg px-3 py-1.5 text-sm font-semibold', state.examinerFlags.includes(value) ? 'bg-red-600 text-white' : 'bg-muted text-muted-foreground')}>{value}</button>
          ))}
        </div>
      </div>
    ) : null}

    <div className="mt-5 rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-black">Examiner comments</h2>
        <Button type="button" variant="outline" size="sm" onClick={addIntervention} className="h-8"><Plus className="mr-1 h-4 w-4" />Add</Button>
      </div>
      <div className="mt-3 space-y-3">
        {state.interventions.length === 0 && <p className="text-xs text-muted-foreground">No interventions recorded.</p>}
        {state.interventions.map((entry, index) => (
          <div key={index} className="rounded-xl border p-3">
            <div className="flex items-center gap-2">
              <Input value={entry.time} onChange={e => updateIntervention(index, 'time', e.target.value)} placeholder="Time" className="h-9 w-24" />
              <Input value={entry.intervention} onChange={e => updateIntervention(index, 'intervention', e.target.value)} placeholder="Intervention" className="h-9 flex-1" />
              <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground" onClick={() => removeIntervention(index)}><X className="h-4 w-4" /></Button>
            </div>
            <Input value={entry.violation} onChange={e => updateIntervention(index, 'violation', e.target.value)} placeholder="Violation" className="mt-2 h-9" />
            <Textarea value={entry.description} onChange={e => updateIntervention(index, 'description', e.target.value)} placeholder="Additional description / location" className="mt-2 min-h-16" />
          </div>
        ))}
      </div>
    </div>

    <div className="mt-5 rounded-2xl border bg-card p-4">
      <label className="text-base font-black" htmlFor="eval-notes">Notes for the student</label>
      <Textarea id="eval-notes" value={state.notes} onChange={event => setState(prev => ({ ...prev, notes: event.target.value }))} placeholder="What should the student practise next?" className="mt-3 min-h-24" />
    </div>

    <div className="mt-5 rounded-2xl border border-[#d4af37]/50 bg-[#fff9e7] p-4 dark:border-[#d4af37]/30 dark:bg-[#332b0e]">
      <p className="text-xs font-bold uppercase tracking-wide text-[#806000] dark:text-[#e5c65c]">Running tally</p>
      <div className="mt-1 flex items-end justify-between gap-3">
        <p className="text-xl font-black text-[#0b0b0d] dark:text-white">{state.outcome ? outcomeText[state.outcome] : 'Outcome not set'}</p>
        <p className="text-right text-sm font-bold text-[#0b0b0d] dark:text-white">{liveCounts.minors} ✓ · {liveCounts.majors} ✗</p>
      </div>
    </div>

    <div className="mt-5 flex flex-wrap gap-2">
      <Button onClick={save} disabled={isSaving} className="min-h-12 flex-1 bg-[#d4af37] font-black text-[#0b0b0d] hover:bg-[#e5c65c]"><Save className="mr-2 h-5 w-5" />{isSaving ? 'Saving…' : savedEvaluation?.id ? 'Save changes' : 'Save evaluation'}</Button>
      {savedEvaluation && <>
        <Button onClick={downloadPdf} className="min-h-12 bg-[#0b0b0d] font-bold"><Download className="mr-2 h-4 w-4" />Download PDF</Button>
        <Button onClick={sharePdf} variant="outline" className="min-h-12"><Share2 className="mr-2 h-4 w-4" />Share PDF</Button>
        {student.email && <Button onClick={() => openContact('email')} variant="outline" className="min-h-12"><Mail className="mr-2 h-4 w-4" />Email</Button>}
        {student.mobileNumber && <><Button onClick={() => openContact('text')} variant="outline" className="min-h-12"><MessageCircle className="mr-2 h-4 w-4" />Text</Button><Button onClick={() => openContact('whatsapp')} variant="outline" className="min-h-12"><MessageCircle className="mr-2 h-4 w-4" />WhatsApp</Button></>}
      </>}
    </div>
    {savedEvaluation && <p className="mt-3 text-center text-xs text-muted-foreground">Saved. The PDF and contact actions use the latest assessment.</p>}
  </div>;
}
