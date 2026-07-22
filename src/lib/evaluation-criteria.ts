import type { EvaluationItem, EvaluationItemStatus, EvaluationMark, EvaluationTestType, EvaluationVerdict } from './types';
import type { ExamSheet } from './evaluation-sheets';

// Mock road-test criteria modeled on the Ontario DriveTest examiner score
// sheets. The G2 test (G1 exit) is city-only; the full G test (G2 exit) keeps
// every city skill and adds freeway driving plus an emergency roadside stop.
// This module is pure (no client/server dependencies) so the evaluation page
// and the API routes share one source of truth for criteria and verdict math.

export interface ManeuverDef {
  id: string;
  label: string;
}

export interface EvaluationSection {
  id: string;
  label: string;
  testTypes: EvaluationTestType[];
  maneuvers: ManeuverDef[];
  extraTags?: string[];
}

export const EVALUATION_SECTIONS: EvaluationSection[] = [
  {
    id: 'start',
    label: 'Start',
    testTypes: ['G2', 'G'],
    maneuvers: [{ id: 'start-pull-out', label: 'Leave parking spot / pull into traffic' }],
  },
  {
    id: 'backing',
    label: 'Backing',
    testTypes: ['G2', 'G'],
    maneuvers: [
      { id: 'backing-up', label: 'Straight-line reverse' },
      { id: 'three-point-turn', label: 'Three-point turn' },
    ],
  },
  {
    id: 'driving',
    label: 'Driving Along',
    testTypes: ['G2', 'G'],
    maneuvers: [
      { id: 'driving-along', label: 'Speed control & keeping up with traffic' },
      { id: 'following-distance', label: 'Following distance (2–3 seconds)' },
      { id: 'mirror-checks', label: 'Mirror checks (every 5–10 seconds)' },
      { id: 'lane-change', label: 'Lane changes (signal · mirror · blind spot)' },
      { id: 'curves', label: 'Curves & lane position' },
    ],
  },
  {
    id: 'intersections',
    label: 'Intersections & Railroad',
    testTypes: ['G2', 'G'],
    maneuvers: [
      { id: 'stopping-intersection', label: 'Stopping (stop-line position, complete stop)' },
      { id: 'through-intersection', label: 'Driving through intersections & signals' },
      { id: 'right-of-way', label: 'Right-of-way (pedestrians · crosswalks · vehicles)' },
      { id: 'railroad-crossing', label: 'Railroad crossing' },
    ],
  },
  {
    id: 'turns',
    label: 'Turns',
    testTypes: ['G2', 'G'],
    maneuvers: [
      { id: 'left-turns', label: 'Left turns (signal · speed · position · observation)' },
      { id: 'right-turns', label: 'Right turns (signal · speed · position · observation)' },
    ],
  },
  {
    id: 'parking',
    label: 'Parking',
    testTypes: ['G2', 'G'],
    maneuvers: [{ id: 'parallel-parking', label: 'Parallel parking (signal · observation · position · curb)' }],
    extraTags: ['Hit/touched curb'],
  },
  {
    id: 'grade',
    label: 'Stop / Park on a Grade',
    testTypes: ['G2', 'G'],
    maneuvers: [{ id: 'roadside-stop', label: 'Roadside stop on grade (signal · position · wheels)' }],
    extraTags: ['Parking brake not set', 'Wheels not angled correctly'],
  },
  {
    id: 'freeway',
    label: 'Freeway / Highway',
    testTypes: ['G'],
    maneuvers: [
      { id: 'freeway-entering', label: 'Entering (merge acceleration & gap selection)' },
      { id: 'freeway-driving', label: 'Driving along at highway speed' },
      { id: 'freeway-lane-change', label: 'Lane changes at speed' },
      { id: 'freeway-exiting', label: 'Exiting (signal · ramp deceleration)' },
    ],
    extraTags: ['Unsafe gap/merge'],
  },
  {
    id: 'emergency',
    label: 'Emergency Roadside Stop',
    testTypes: ['G'],
    maneuvers: [{ id: 'emergency-stop', label: 'Emergency stop on request (signal · hazards · safe pull-over)' }],
    extraTags: ['No hazard lights'],
  },
];

export const FAULT_TAGS = [
  'No signal',
  'No mirror',
  'No blind spot',
  'Speed too high',
  'Speed too low',
  'Poor lane position',
  'Late/hesitant',
  'Too wide/cut corner',
  'Rolled the stop',
  'Failed to yield',
];

export const AUTOFAIL_OPTIONS = [
  'Dangerous action',
  'Collision/mounted curb',
  'Instructor took control',
  'Stopped/rolled on railway tracks',
  "Didn't follow instruction",
];

export const TEST_TYPES: EvaluationTestType[] = ['G2', 'G'];

export const TEST_TYPE_LABELS: Record<EvaluationTestType, string> = {
  G2: 'G2 · City test',
  G: 'G · Highway + city',
};

const GENERAL_SECTION_ID = 'general';
const GENERAL_SECTION_LABEL = 'General';

export function getSections(testType: EvaluationTestType): EvaluationSection[] {
  return EVALUATION_SECTIONS.filter(section => section.testTypes.includes(testType));
}

export function buildEvaluationItems(testType: EvaluationTestType): EvaluationItem[] {
  return getSections(testType).flatMap(section =>
    section.maneuvers.map(maneuver => ({
      id: maneuver.id,
      name: maneuver.label,
      status: 'ok' as EvaluationItemStatus,
      tags: [],
      category: section.id,
    }))
  );
}

export function getFaultTags(sectionId?: string): string[] {
  const section = EVALUATION_SECTIONS.find(item => item.id === sectionId);
  return section?.extraTags?.length ? [...FAULT_TAGS, ...section.extraTags] : FAULT_TAGS;
}

export interface EvaluationItemGroup {
  id: string;
  label: string;
  items: EvaluationItem[];
}

// Older records have no category — they collapse into one "General" group so
// they render exactly as they did before sections existed.
export function groupItemsBySection(items: EvaluationItem[]): EvaluationItemGroup[] {
  const groups = new Map<string, EvaluationItemGroup>();
  for (const item of items) {
    const section = EVALUATION_SECTIONS.find(candidate => candidate.id === item.category);
    const id = section?.id || GENERAL_SECTION_ID;
    const label = section?.label || GENERAL_SECTION_LABEL;
    const group = groups.get(id) || { id, label, items: [] };
    group.items.push(item);
    groups.set(id, group);
  }
  const order = [...EVALUATION_SECTIONS.map(section => section.id), GENERAL_SECTION_ID];
  return Array.from(groups.values()).sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}

export function countStatuses(items: EvaluationItem[]): { minors: number; majors: number } {
  return {
    minors: items.filter(item => item.status === 'minor').length,
    majors: items.filter(item => item.status === 'major').length,
  };
}

export function calculateVerdict(minors: number, majors: number, autofailCount: number): EvaluationVerdict {
  if (autofailCount > 0 || majors >= 2 || (majors >= 1 && minors >= 4)) return 'fail';
  if (majors >= 1 || minors >= 4) return 'borderline';
  return 'pass';
}

function cleanString(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

const STATUS_SET = new Set<EvaluationItemStatus>(['ok', 'minor', 'major']);

// Any ✗ (major) mark makes the item major; else any ✓ (minor) makes it minor.
export function deriveItemStatus(marks: EvaluationMark[] | undefined): EvaluationItemStatus {
  if (!marks?.length) return 'ok';
  if (marks.some(mark => mark.severity === 'major')) return 'major';
  return 'minor';
}

function normalizeMarks(input: unknown): EvaluationMark[] {
  const marks = Array.isArray(input) ? input : [];
  return marks
    .map(mark => {
      const record = mark && typeof mark === 'object' ? (mark as Record<string, unknown>) : {};
      const severity = cleanString(record.severity, 10);
      const lane = cleanString(record.lane, 20);
      return {
        code: cleanString(record.code, 3),
        severity: severity === 'major' ? ('major' as const) : ('minor' as const),
        ...(lane ? { lane } : {}),
      };
    })
    .slice(0, 40);
}

// Unknown item ids and categories are accepted on purpose: old records use
// retired ids, and rejecting them would make historical evaluations unsavable.
export function normalizeEvaluationItems(input: unknown): EvaluationItem[] {
  const inputItems = Array.isArray(input) ? input : [];
  return inputItems
    .map((item, index) => {
      const record = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
      const category = cleanString(record.category, 40);
      const hasMarks = Array.isArray(record.marks);
      const marks = hasMarks ? normalizeMarks(record.marks) : undefined;
      // Sheet records derive status from marks; legacy records keep their status.
      const rawStatus = cleanString(record.status, 10) as EvaluationItemStatus;
      const status = hasMarks
        ? deriveItemStatus(marks)
        : STATUS_SET.has(rawStatus)
          ? rawStatus
          : ('ok' as EvaluationItemStatus);
      return {
        id: cleanString(record.id, 100) || `item-${index + 1}`,
        name: cleanString(record.name, 200),
        status,
        tags: Array.isArray(record.tags)
          ? record.tags.map(tag => cleanString(tag, 80)).filter(Boolean).slice(0, 20)
          : [],
        ...(category ? { category } : {}),
        ...(marks ? { marks } : {}),
      };
    })
    .filter(item => item.name);
}

export function normalizeAutofails(input: unknown): string[] {
  const allowed = new Set(AUTOFAIL_OPTIONS);
  return Array.isArray(input)
    ? input.map(item => cleanString(item, 100)).filter(item => allowed.has(item))
    : [];
}

// Normalizes the DriveTest-sheet-only evaluation fields. Reason/flag strings are
// filtered against the sheet's own lists; interventions are free text.
export function normalizeSheetExtras(sheet: ExamSheet | null, body: Record<string, unknown>) {
  const reasonSet = new Set(sheet?.summaryReasons || []);
  const improperSet = new Set(sheet?.improperUseOf || []);
  const flagSet = new Set(sheet?.examinerFlags || []);
  const outcomeRaw = cleanString(body.outcome, 20);
  const outcome = outcomeRaw === 'meets' || outcomeRaw === 'does-not-meet' ? outcomeRaw : undefined;

  const sectionStatus: Record<string, 'ok' | 'not-completed'> = {};
  if (body.sectionStatus && typeof body.sectionStatus === 'object') {
    for (const [key, value] of Object.entries(body.sectionStatus as Record<string, unknown>)) {
      const state = cleanString(value, 20);
      if (state === 'ok' || state === 'not-completed') sectionStatus[cleanString(key, 60)] = state;
    }
  }

  const interventions = Array.isArray(body.interventions)
    ? body.interventions.slice(0, 12).map(entry => {
        const record = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {};
        return {
          time: cleanString(record.time, 20),
          intervention: cleanString(record.intervention, 200),
          violation: cleanString(record.violation, 200),
          description: cleanString(record.description, 500),
        };
      }).filter(entry => entry.time || entry.intervention || entry.violation || entry.description)
    : [];

  return {
    sheetVersion: sheet?.version,
    outcome,
    sectionStatus,
    summaryReasons: Array.isArray(body.summaryReasons)
      ? body.summaryReasons.map(v => cleanString(v, 120)).filter(v => reasonSet.has(v))
      : [],
    improperUseOf: Array.isArray(body.improperUseOf)
      ? body.improperUseOf.map(v => cleanString(v, 60)).filter(v => improperSet.has(v))
      : [],
    examinerFlags: Array.isArray(body.examinerFlags)
      ? body.examinerFlags.map(v => cleanString(v, 60)).filter(v => flagSet.has(v))
      : [],
    interventions,
  };
}
