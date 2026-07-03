'use client';

import { useMemo, useRef, useState } from 'react';
import {
  collection,
  doc,
  getDocs,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { AlertTriangle, Database, Download, FileJson, RefreshCw, Upload } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useStudents } from '@/hooks/use-students';
import { useUtilityTracker, type UtilityTrackerData } from '@/hooks/use-utility-tracker';
import { useActiveTenantId, useFirestore } from '@/firebase';
import { Student } from '@/lib/types';
import { downloadJson } from '@/lib/utils';

type BackupMode = 'merge' | 'replace';

type CollectionBackup = {
  name: string;
  label: string;
  exportedAt: string;
  records: Array<{ id: string; data: Record<string, unknown> }>;
};

type FullBackup = {
  app: 'sparkon-instructor-pro' | 'instructoros';
  version: 3;
  exportedAt: string;
  collections: Record<string, CollectionBackup>;
  localStorage: {
    utilityTrackerData_v4: UtilityTrackerData | null;
  };
};

const COLLECTIONS = [
  { name: 'students', label: 'Students' },
  { name: 'events', label: 'Schedule Events' },
  { name: 'payments', label: 'Payments & History' },
  { name: 'services', label: 'Services' },
  { name: 'serviceCategories', label: 'Service Categories' },
  { name: 'business_expenses', label: 'Business Expenses' },
] as const;

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

function downloadText(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function csvEscape(value: unknown) {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function recordsToCsv(records: Array<Record<string, unknown>>) {
  const headers = Array.from(
    records.reduce((keys, record) => {
      Object.keys(record).forEach(key => keys.add(key));
      return keys;
    }, new Set<string>())
  );

  if (headers.length === 0) return '';

  const rows = records.map(record => headers.map(header => csvEscape(record[header])).join(','));
  return [headers.join(','), ...rows].join('\n');
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuote = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuote && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (char === ',' && !inQuote) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function normalizeStudentCsvKey(key: string) {
  const normalized = key.toLowerCase().replace(/\s+/g, '');
  const map: Record<string, keyof Omit<Student, 'id' | 'registrationDate' | 'status'>> = {
    name: 'name',
    mobilenumber: 'mobileNumber',
    phone: 'mobileNumber',
    phonenumber: 'mobileNumber',
    mobile: 'mobileNumber',
    address: 'address',
    birthdate: 'birthdate',
    birthday: 'birthdate',
    licensenumber: 'licenseNumber',
    license: 'licenseNumber',
    licenseexpiry: 'licenseExpiry',
    expiry: 'licenseExpiry',
    licensetype: 'licenseType',
    type: 'licenseType',
    comments: 'comments',
    notes: 'comments',
    tags: 'tags',
    tag: 'tags',
    customertags: 'tags',
  };
  return map[normalized];
}

function tenantCollectionPath(activeTenantId: string, collectionName: string) {
  return `tenants/${activeTenantId}/${collectionName}`;
}

async function fetchCollectionBackup(firestore: Firestore, activeTenantId: string, collectionName: string, label: string) {
  const snapshot = await getDocs(collection(firestore, tenantCollectionPath(activeTenantId, collectionName)));
  return {
    name: collectionName,
    label,
    exportedAt: new Date().toISOString(),
    records: snapshot.docs.map(item => ({ id: item.id, data: item.data() })),
  } satisfies CollectionBackup;
}

async function deleteCollectionRecords(firestore: Firestore, activeTenantId: string, collectionName: string) {
  const snapshot = await getDocs(collection(firestore, tenantCollectionPath(activeTenantId, collectionName)));
  const docs = snapshot.docs;

  for (let i = 0; i < docs.length; i += 450) {
    const batch = writeBatch(firestore);
    docs.slice(i, i + 450).forEach(item => batch.delete(item.ref));
    await batch.commit();
  }
}

async function writeCollectionRecords(
  firestore: Firestore,
  activeTenantId: string,
  collectionName: string,
  records: Array<{ id: string; data: Record<string, unknown> }>,
  mode: BackupMode
) {
  if (mode === 'replace') {
    await deleteCollectionRecords(firestore, activeTenantId, collectionName);
  }

  for (let i = 0; i < records.length; i += 450) {
    const batch = writeBatch(firestore);
    records.slice(i, i + 450).forEach(record => {
      batch.set(doc(firestore, tenantCollectionPath(activeTenantId, collectionName), record.id), record.data, { merge: mode === 'merge' });
    });
    await batch.commit();
  }
}

export function ImportExportClientPage() {
  const firestore = useFirestore();
  const activeTenantId = useActiveTenantId();
  const { students, addStudent } = useStudents();
  const { data: utilityData, saveData: saveUtilityData } = useUtilityTracker();
  const { toast } = useToast();

  const importRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<BackupMode>('merge');
  const [isBusy, setIsBusy] = useState(false);

  const collectionRows = useMemo(() => {
    return COLLECTIONS.map(item => ({
      ...item,
      helper:
        item.name === 'students'
          ? 'Student records and license details'
          : item.name === 'events'
            ? 'Schedule, lesson status, Google links, payment links'
            : item.name === 'payments'
              ? 'Bills, paid/unpaid records, payment history'
              : item.name === 'services'
                ? 'Lesson services, prices, costs, duration'
                : item.name === 'business_expenses'
                  ? 'Expense records and receipt scan data'
                  : 'Service grouping/order',
    }));
  }, []);

  const buildFullBackup = async (): Promise<FullBackup> => {
    if (!firestore || !activeTenantId) throw new Error('Database is not ready yet.');

    const collectionEntries = await Promise.all(
      COLLECTIONS.map(async item => {
        const backup = await fetchCollectionBackup(firestore, activeTenantId, item.name, item.label);
        return [item.name, backup] as const;
      })
    );

    return {
      app: 'instructoros',
      version: 3,
      exportedAt: new Date().toISOString(),
      collections: Object.fromEntries(collectionEntries),
      localStorage: {
        utilityTrackerData_v4: utilityData,
      },
    };
  };

  const handleFullJsonExport = async () => {
    try {
      setIsBusy(true);
      const backup = await buildFullBackup();
      downloadJson(backup, `sparkon-full-backup-${todayStamp()}.json`);
      toast({ title: 'Backup downloaded', description: 'Everything was exported into one JSON file.' });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Could not export your data.',
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleCollectionCsvExport = async (collectionName: string, label: string) => {
    if (!firestore || !activeTenantId) {
      toast({ variant: 'destructive', title: 'Database is not ready yet.' });
      return;
    }

    try {
      setIsBusy(true);
      const backup = await fetchCollectionBackup(firestore, activeTenantId, collectionName, label);
      const records = backup.records.map(record => ({ id: record.id, ...record.data }));
      const csv = recordsToCsv(records);
      if (!csv) {
        toast({ title: 'Nothing to export', description: `${label} has no records yet.` });
        return;
      }
      downloadText(csv, `sparkon-${collectionName}-${todayStamp()}.csv`, 'text/csv;charset=utf-8;');
      toast({ title: 'CSV downloaded', description: `${label} was exported.` });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'CSV export failed',
        description: error instanceof Error ? error.message : 'Could not export this section.',
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleUtilityCsvExport = () => {
    if (!utilityData) {
      toast({ title: 'Nothing to export', description: 'Utility Tracker has no data loaded yet.' });
      return;
    }

    const rows = utilityData.monthlyData.map(month => ({
      id: month.id,
      year: month.year,
      month: month.month + 1,
      gas: month.utilities.gas,
      electricity: month.utilities.electricity,
      wifi: month.utilities.wifi,
      water: month.utilities.water,
      numberOfPeople: month.utilities.numberOfPeople,
      mortgage: month.myCosts.mortgage,
      insurance: month.myCosts.insurance,
      maintenance: month.myCosts.maintenance,
      waterTank: month.myCosts.waterTank,
      houseTax: month.myCosts.houseTax,
      waterBill: month.myCosts.waterBill,
      rentalIn: month.myCosts.rentalIn,
      tenants: month.rent.tenants,
    }));

    downloadText(
      recordsToCsv(rows),
      `sparkon-utility-tracker-${todayStamp()}.csv`,
      'text/csv;charset=utf-8;'
    );
    toast({ title: 'CSV downloaded', description: 'Utility Tracker was exported.' });
  };

  const handleImportClick = () => {
    importRef.current?.click();
  };

  const importFullBackup = async (backup: FullBackup) => {
    if (!firestore || !activeTenantId) throw new Error('Database is not ready yet.');
    if (!['sparkon-instructor-pro', 'instructoros'].includes(backup.app) || !backup.collections) {
      throw new Error('This does not look like an InstructorOS full backup file.');
    }

    if (mode === 'replace') {
      const confirmed = window.confirm(
        'Replace mode will delete existing records in the backed-up sections before restoring. Continue?'
      );
      if (!confirmed) return;
    }

    for (const item of COLLECTIONS) {
      const section = backup.collections[item.name];
      if (!section?.records) continue;
      await writeCollectionRecords(firestore, activeTenantId, item.name, section.records, mode);
    }

    const utilityBackup = backup.localStorage?.utilityTrackerData_v4;
    if (utilityBackup) {
      saveUtilityData(utilityBackup);
    }

    toast({
      title: 'Backup restored',
      description: mode === 'replace' ? 'Existing data was replaced from the file.' : 'Backup data was merged into the app.',
    });
  };

  const importStudentFile = async (text: string, file: File) => {
    let importedStudents: Omit<Student, 'id' | 'registrationDate' | 'status'>[] = [];
    const failedRows: { row: number; error: string }[] = [];

    if (file.type === 'application/json' || file.name.endsWith('.json')) {
      const parsed = JSON.parse(text);
      const studentRows = Array.isArray(parsed) ? parsed : parsed.students;

      if (!Array.isArray(studentRows)) {
        throw new Error('For student import, JSON must be an array of student records.');
      }

      studentRows.forEach((student: Partial<Student>, index: number) => {
        if (student.name && student.licenseNumber) {
          const { id, registrationDate, status, ...studentData } = student;
          importedStudents.push(studentData as Omit<Student, 'id' | 'registrationDate' | 'status'>);
        } else {
          failedRows.push({ row: index + 1, error: 'Missing name or licenseNumber' });
        }
      });
    } else {
      const lines = text.split(/\r\n|\n/).filter(line => line.trim());
      if (lines.length < 2) throw new Error('CSV file is empty or has only a header.');

      const header = parseCsvLine(lines[0]).map(h => h.trim());
      const normalized = header.map(h => h.toLowerCase().replace(/\s+/g, ''));
      const nameIndex = normalized.indexOf('name');
      const licenseIndex = normalized.indexOf('licensenumber');

      if (nameIndex === -1 || licenseIndex === -1) {
        throw new Error("CSV must contain 'name' and 'licenseNumber' columns.");
      }

      lines.slice(1).forEach((line, index) => {
        const values = parseCsvLine(line);
        const studentData: Record<string, unknown> = {};

        header.forEach((rawKey, i) => {
          const key = normalizeStudentCsvKey(rawKey);
          if (!key) return;
          if (key === 'tags') {
            studentData[key] = (values[i] || '')
              .split(/[|;]/)
              .map(tag => tag.trim())
              .filter(Boolean);
            return;
          }
          studentData[key] = values[i] || '';
        });

        if (studentData.name && studentData.licenseNumber) {
          importedStudents.push(studentData as Omit<Student, 'id' | 'registrationDate' | 'status'>);
        } else {
          failedRows.push({ row: index + 2, error: 'Missing name or licenseNumber' });
        }
      });
    }

    for (const student of importedStudents) {
      await addStudent(student);
    }

    if (failedRows.length > 0) {
      console.error('Failed student rows:', failedRows);
      toast({
        variant: 'destructive',
        title: 'Import partially finished',
        description: `${importedStudents.length} students imported. ${failedRows.length} rows failed.`,
      });
      return;
    }

    toast({ title: 'Students imported', description: `${importedStudents.length} students were added.` });
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsBusy(true);
      const text = await file.text();
      const parsed = file.name.endsWith('.json') ? JSON.parse(text) : null;

      if ((parsed?.app === 'sparkon-instructor-pro' || parsed?.app === 'instructoros') && parsed?.collections) {
        await importFullBackup(parsed as FullBackup);
      } else {
        await importStudentFile(text, file);
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Import failed',
        description: error instanceof Error ? error.message : 'Could not read this file.',
        duration: 9000,
      });
    } finally {
      setIsBusy(false);
      event.target.value = '';
    }
  };

  const studentCount = students?.length || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Import / Export</h1>
          <p className="text-muted-foreground">
            Back up, restore, and download the important data across the whole app.
          </p>
        </div>
        <Button onClick={handleFullJsonExport} disabled={isBusy || !firestore}>
          {isBusy ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
          Full Backup
        </Button>
      </div>

      <input
        type="file"
        ref={importRef}
        className="hidden"
        onChange={handleFileImport}
        accept="application/json,text/csv,.json,.csv"
      />

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Complete Backup</CardTitle>
            <CardDescription>
              Download one JSON file containing students, schedule, payments, services, expenses, and Utility Tracker data.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Button onClick={handleFullJsonExport} disabled={isBusy || !firestore} className="h-12">
              <FileJson className="mr-2 h-4 w-4" />
              Download Full JSON
            </Button>
            <Button variant="outline" onClick={handleImportClick} disabled={isBusy} className="h-12">
              <Upload className="mr-2 h-4 w-4" />
              Restore / Import File
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Restore Mode</CardTitle>
            <CardDescription>
              Merge is safest. Replace is for restoring an exact backup after you already saved a copy.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Import behavior</Label>
              <Select value={mode} onValueChange={value => setMode(value as BackupMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="merge">Merge / update existing data</SelectItem>
                  <SelectItem value="replace">Replace matching sections</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">
              Student CSV/JSON imports always add students. Full backup JSON uses the mode above.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Export Sections as CSV</CardTitle>
          <CardDescription>
            CSV files are good for Excel or Google Sheets. Use the full JSON backup for true restore.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {collectionRows.map(item => (
            <div key={item.name} className="rounded-lg border p-4">
              <div className="mb-3">
                <p className="font-semibold">{item.label}</p>
                <p className="text-sm text-muted-foreground">{item.helper}</p>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleCollectionCsvExport(item.name, item.label)}
                disabled={isBusy || !firestore}
              >
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
          ))}

          <div className="rounded-lg border p-4">
            <div className="mb-3">
              <p className="font-semibold">Utility Tracker</p>
              <p className="text-sm text-muted-foreground">Local utility, rent, and home cost tracker data</p>
            </div>
            <Button variant="outline" className="w-full" onClick={handleUtilityCsvExport} disabled={isBusy || !utilityData}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Simple Student Import</CardTitle>
          <CardDescription>
            You can still upload a student CSV or student JSON list. Current students in the app: {studentCount}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2">
            <Label>Required columns</Label>
            <Input readOnly value="name, licenseNumber" />
          </div>
          <Button variant="outline" onClick={handleImportClick} disabled={isBusy}>
            <Upload className="mr-2 h-4 w-4" />
            Import Student CSV / JSON
          </Button>
        </CardContent>
      </Card>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Use Full Backup Before Big Changes</AlertTitle>
        <AlertDescription>
          Full JSON backup is the safest file because it can restore app data with document IDs. CSV is mainly for viewing and reporting.
        </AlertDescription>
      </Alert>
    </div>
  );
}
