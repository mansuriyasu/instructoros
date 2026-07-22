import type { EvaluationItem, EvaluationTestType } from './types';

// Faithful reproductions of the Ontario DriveTest examiner score sheets
// ("Record of G2 Examination" and "Record of G Examination"), transcribed
// verbatim from the official forms. The examiner marks each line with a letter
// code and either ✓ ("some improvement necessary") or ✗ ("lack of skill,
// knowledge or judgment"); there are no point values — the outcome is
// Meets / Does Not Meet Ministry Standards. Nothing here is paraphrased.

export interface SheetCode {
  code: string; // "A", "B", ... (empty string when the line has no sub-codes)
  label: string;
}

export interface SheetItem {
  id: string;
  number: string; // the printed line number, e.g. "1", "2"
  label: string; // the line heading, e.g. "Signalling:"
  codes: SheetCode[];
}

export interface SheetGroup {
  id: string;
  title?: string; // sub-heading like "Approach:", "If Stop:"
  items: SheetItem[];
}

export interface SheetLane {
  id: string;
  label: string;
}

export interface SheetSection {
  id: string;
  label: string;
  lanes?: SheetLane[]; // when present, each item is marked separately per lane
  groups: SheetGroup[];
}

export interface ExamSheet {
  version: string;
  testType: EvaluationTestType;
  legend: string;
  sections: SheetSection[];
  summaryReasonsLabel: string;
  summaryReasons: string[];
  improperUseOf?: string[];
  examinerFlags: string[];
}

const LEGEND =
  '(OK) manoeuvre satisfactory · (✓) some improvement necessary · (✗) lack of skill, knowledge or judgment';

const c = (code: string, label: string): SheetCode => ({ code, label });

// ── Record of G2 Examination ────────────────────────────────────────────────

const G2_TURN_ITEMS: SheetItem[] = [
  { id: 'turns-1', number: '1', label: 'Signalling', codes: [c('A', 'Wrong'), c('B', 'Early'), c('C', 'Late'), c('D', 'Not given'), c('E', 'Not cancelled')] },
  { id: 'turns-2', number: '2', label: 'Failed to get in proper', codes: [c('A', 'Position'), c('B', 'Lane'), c('C', 'Late into lane'), c('D', 'Late into position')] },
  { id: 'turns-3', number: '3', label: 'Right-of-way observance', codes: [c('A', 'Ped.'), c('B', 'Self'), c('C', 'Position'), c('D', 'Other vehicles')] },
  { id: 'turns-4', number: '4', label: 'Too Wide', codes: [c('A', 'Turns too wide'), c('B', 'Enters wrong lane')] },
  { id: 'turns-5', number: '5', label: 'Too Short', codes: [c('A', 'Cuts corner'), c('B', 'Enters wrong lane')] },
  { id: 'turns-6', number: '6', label: 'Steering', codes: [c('A', 'Method'), c('B', 'Control'), c('C', 'Recovery')] },
  { id: 'turns-7', number: '7', label: 'Speed', codes: [c('A', 'Too Fast'), c('B', 'Fast-enter'), c('C', 'Fast-leave'), c('D', 'Too-slow'), c('E', 'Slow-enter'), c('F', 'Slow-leave'), c('G', 'Impedes')] },
  { id: 'turns-8', number: '8', label: 'Incorrect use of', codes: [c('A', 'Clutch'), c('B', 'Brake'), c('C', 'Accelerator'), c('D', 'Gears')] },
];

export const G2_SHEET: ExamSheet = {
  version: 'on-g2-v1',
  testType: 'G2',
  legend: LEGEND,
  sections: [
    {
      id: 'start',
      label: 'Start',
      groups: [{ id: 'start', items: [
        { id: 'start-1', number: '1', label: 'Unable to', codes: [c('A', 'Locate'), c('B', 'Adjust'), c('C', 'Operate safety devices')] },
        { id: 'start-2', number: '2', label: '', codes: [c('A', 'Fails to observe'), c('B', 'Uses mirror only')] },
        { id: 'start-3', number: '3', label: '', codes: [c('A', 'Fails to signal'), c('B', 'Improper signal')] },
        { id: 'start-4', number: '4', label: 'Incorrect use of', codes: [c('A', 'Clutch'), c('B', 'Brake'), c('C', 'Accelerator'), c('D', 'Gears')] },
      ] }],
    },
    {
      id: 'backing',
      label: 'Backing',
      groups: [{ id: 'backing', items: [
        { id: 'backing-1', number: '1', label: 'Backing', codes: [c('A', 'Control'), c('B', 'Steering method'), c('C', 'Observation'), c('D', 'Veh. position')] },
        { id: 'backing-2', number: '2', label: 'Turnabout', codes: [c('A', 'Control'), c('B', 'Steering method'), c('C', 'Observation'), c('D', 'Veh. position')] },
        { id: 'backing-3', number: '3', label: 'Incorrect use of', codes: [c('A', 'Clutch'), c('B', 'Brake'), c('C', 'Gears'), c('D', 'Steering')] },
      ] }],
    },
    {
      id: 'driving',
      label: 'Driving Along',
      groups: [{ id: 'driving', items: [
        { id: 'driving-1', number: '1', label: '', codes: [c('A', 'Follows too closely'), c('B', 'Passes too closely'), c('C', 'Cuts in too soon')] },
        { id: 'driving-2', number: '2', label: '', codes: [c('A', 'Improper choice of lane'), c('B', 'Straddles lane'), c('C', 'Unmarked roadway')] },
        { id: 'driving-3', number: '3', label: '', codes: [c('A', 'Fails to check blindspot'), c('B', 'Observe properly')] },
        { id: 'driving-4', number: '4', label: 'Lane change signal', codes: [c('A', 'Wrong'), c('B', 'Early'), c('C', 'Late'), c('D', 'Not given'), c('E', 'Not cancelled')] },
        { id: 'driving-5', number: '5', label: 'Right-of-way observance', codes: [c('A', 'Ped.'), c('B', 'Self'), c('C', 'Other vehicles')] },
        { id: 'driving-6', number: '6', label: 'Fails to use caution', codes: [c('A', 'Ped. cross-overs'), c('B', 'School crossing'), c('C', 'Emerg.veh.')] },
        { id: 'driving-7', number: '7', label: 'Fails to obey', codes: [c('A', 'Ped. cross-overs'), c('B', 'School crossing'), c('C', 'Emerg.veh.')] },
        { id: 'driving-8', number: '8', label: 'Speed', codes: [c('A', 'Too fast'), c('B', 'Slow for condition'), c('C', 'Impedes traffic')] },
        { id: 'driving-9', number: '9', label: 'Incorrect use of', codes: [c('A', 'Clutch'), c('B', 'Brake'), c('C', 'Accelerator'), c('D', 'Gears'), c('E', 'Steering'), c('F', 'Safety devices')] },
      ] }],
    },
    {
      id: 'intersections',
      label: 'Intersections / R.R Crossing',
      groups: [{ id: 'intersections', items: [
        { id: 'intersections-1', number: '1', label: 'Fails to observe properly', codes: [c('A', 'Controlled'), c('B', 'Uncontrolled intersections')] },
        { id: 'intersections-2', number: '2', label: 'Fails to obey', codes: [c('A', 'Signs'), c('B', 'Signals'), c('C', 'Pavement markings')] },
        { id: 'intersections-3', number: '3', label: 'Late in', codes: [c('A', 'Slowing'), c('B', 'Stopping'), c('C', 'Slows too soon')] },
        { id: 'intersections-4', number: '4', label: 'Stopping position', codes: [c('A', 'Too soon'), c('B', 'Blocks crosswalk'), c('C', 'Blocks intersection')] },
        { id: 'intersections-5', number: '5', label: 'Right-of-way observance', codes: [c('A', 'Ped.'), c('B', 'Self'), c('C', 'Other vehicle')] },
      ] }],
    },
    {
      id: 'turns',
      label: 'Turns',
      lanes: [{ id: 'L', label: 'Left Turns' }, { id: 'R', label: 'Right Turns' }],
      groups: [{ id: 'turns', items: G2_TURN_ITEMS }],
    },
    {
      id: 'parking',
      label: 'Parking',
      groups: [{ id: 'parking', items: [
        { id: 'parking-1', number: '1', label: 'Fails to observe', codes: [c('A', 'Backing'), c('B', 'Leaving'), c('C', 'Mirror only backing'), c('D', 'Mirror only leaving')] },
        { id: 'parking-2', number: '2', label: 'Hits', codes: [c('A', 'Objects'), c('B', 'Other vehicles'), c('C', 'Climbs curb')] },
        { id: 'parking-3', number: '3', label: '', codes: [c('A', 'Incorrect vehicle position')] },
        { id: 'parking-4', number: '4', label: '', codes: [c('A', 'Fails to signal when leaving'), c('B', 'Incorrect signal')] },
        { id: 'parking-5', number: '5', label: 'Incorrect use of', codes: [c('A', 'Clutch'), c('B', 'Brake'), c('C', 'Accelerator'), c('D', 'Gears'), c('E', 'Steering')] },
      ] }],
    },
    {
      id: 'grade',
      label: 'Stop, Park and Start on a Grade',
      groups: [{ id: 'grade', items: [
        { id: 'grade-1', number: '1', label: 'Fails to observe', codes: [c('A', 'Properly'), c('B', 'Uses mirror only'), c('C', 'Signals before leaving')] },
        { id: 'grade-2', number: '2', label: '', codes: [c('A', 'Rolls back when parking'), c('B', 'Starting')] },
        { id: 'grade-3', number: '3', label: '', codes: [c('A', 'Fails to angle wheels properly'), c('B', 'Incorrect vehicle position')] },
        { id: 'grade-4', number: '4', label: '', codes: [c('A', 'Fails to set parking brake'), c('B', 'Select proper gear')] },
        { id: 'grade-5', number: '5', label: 'Incorrect use of', codes: [c('A', 'Clutch'), c('B', 'Brake'), c('C', 'Accelerator'), c('D', 'Gears'), c('E', 'Steering')] },
      ] }],
    },
  ],
  summaryReasonsLabel: 'Summary Reasons for Disqualification',
  summaryReasons: [
    'Right-of-way: ped./self/other traffic',
    'Intersections: controlled/uncontrolled',
    'Pavement or lane markings',
    'Traffic signs & signals',
    'Backing manoeuvres',
    'Following distances',
    'Turn manoeuvres / intersections',
    'Parking skills',
    'Speed (fast / slow)',
    'Inadequate skill to complete test',
    'Too many driving errors',
  ],
  improperUseOf: ['Steering', 'Accelerator', 'Brakes', 'Clutch', 'Gears'],
  examinerFlags: ['Preventable collision', 'Dangerous Action', 'Traffic law violation'],
};

// ── Record of G Examination (G2 exit) ───────────────────────────────────────

const LR_LANES: SheetLane[] = [{ id: 'L', label: 'Left (L)' }, { id: 'R', label: 'Right (R)' }];

export const G_SHEET: ExamSheet = {
  version: 'on-g-v1',
  testType: 'G',
  legend: LEGEND,
  sections: [
    {
      id: 'turns',
      label: 'Turns',
      lanes: LR_LANES,
      groups: [
        { id: 'approach', title: 'Approach:', items: [
          { id: 'turns-approach-1', number: '1', label: 'Traffic check', codes: [c('A', 'No mirrors')] },
          { id: 'turns-approach-2', number: '2', label: 'Traffic check', codes: [c('A', 'No blind spot')] },
          { id: 'turns-approach-3', number: '3', label: 'Lane', codes: [c('A', 'Incorrect'), c('B', 'late lane')] },
          { id: 'turns-approach-4', number: '4', label: 'Signal', codes: [c('A', 'No'), c('B', 'late'), c('C', 'entrance')] },
          { id: 'turns-approach-5', number: '5', label: 'Speed', codes: [c('A', 'Uneven'), c('B', 'brake'), c('C', 'gears'), c('D', 'coast')] },
          { id: 'turns-approach-6', number: '6', label: 'Gap', codes: [c('A', 'Less than 2-3 sec')] },
        ] },
        { id: 'if-stop', title: 'If Stop:', items: [
          { id: 'turns-stop-1', number: '1', label: 'Full Stop', codes: [c('A', 'No'), c('B', 'roll'), c('C', 'block traffic')] },
          { id: 'turns-stop-2', number: '2', label: 'Position', codes: [c('A', 'No rear wheels'), c('B', 'over line'), c('C', 'wheels turned')] },
          { id: 'turns-stop-3', number: '3', label: 'Traffic Check', codes: [c('A', 'None while waiting')] },
        ] },
        { id: 'turning', title: 'Turning:', items: [
          { id: 'turns-turning-1', number: '1', label: 'Traffic Check', codes: [c('A', 'No left-right-left')] },
          { id: 'turns-turning-2', number: '2', label: 'Traffic Check', codes: [c('A', 'No blind spot'), c('B', 'conflict')] },
          { id: 'turns-turning-3', number: '3', label: 'Hands/Gears', codes: [c('A', 'One hand'), c('B', 'change')] },
          { id: 'turns-turning-4', number: '4', label: 'Speed', codes: [c('A', 'Wait 4-5 sec'), c('B', 'too fast'), c('C', 'slow')] },
          { id: 'turns-turning-5', number: '5', label: 'Wide/Short', codes: [c('A', 'Too wide'), c('B', 'Short')] },
        ] },
        { id: 'complete-turn', title: 'Complete Turn:', items: [
          { id: 'turns-complete-1', number: '1', label: 'Lane', codes: [c('A', 'Wrong lane'), c('B', 'not move right')] },
          { id: 'turns-complete-2', number: '2', label: 'Traffic Check', codes: [c('A', 'Not by traffic speed')] },
          { id: 'turns-complete-3', number: '3', label: 'Speed', codes: [c('A', 'Fast'), c('B', 'slow'), c('C', 'lug'), c('D', 'rev'), c('E', 'gears')] },
        ] },
      ],
    },
    {
      id: 'lane-changes',
      label: 'Lane Changes',
      lanes: [
        { id: 'business-L', label: 'Business L' },
        { id: 'business-R', label: 'Business R' },
        { id: 'expressway-L', label: 'Expressway L' },
        { id: 'expressway-R', label: 'Expressway R' },
      ],
      groups: [{ id: 'lane-changes', items: [
        { id: 'lc-1', number: '1', label: 'Traffic Check', codes: [c('A', 'Front/left-right'), c('B', 'mirrors'), c('C', 'conflict')] },
        { id: 'lc-2', number: '2', label: 'Traffic check', codes: [c('A', 'No blind spot')] },
        { id: 'lc-3', number: '3', label: 'Signal', codes: [c('A', 'Not 2-3 sec early')] },
        { id: 'lc-4', number: '4', label: 'Spacing', codes: [c('A', 'Front'), c('B', 'behind'), c('C', 'sides')] },
        { id: 'lc-5', number: '5', label: 'Speed', codes: [c('A', 'Too fast'), c('B', 'slow')] },
        { id: 'lc-6', number: '6', label: 'Change', codes: [c('A', 'Sharp'), c('B', 'not to center')] },
        { id: 'lc-7', number: '7', label: 'Hands', codes: [c('A', 'One hand')] },
        { id: 'lc-8', number: '8', label: 'Signal', codes: [c('A', 'On after 5 sec')] },
      ] }],
    },
    {
      id: 'business-residential',
      label: 'Business/Residential',
      lanes: [{ id: 'business', label: 'Business' }],
      groups: [{ id: 'business-residential', items: [
        { id: 'br-1', number: '1', label: 'Traffic Check', codes: [c('A', 'Not look at hazard')] },
        { id: 'br-2', number: '2', label: 'Traffic Check', codes: [c('A', 'Not look at hazard')] },
        { id: 'br-3', number: '3', label: 'Traffic Check', codes: [c('A', 'Not look at hazard')] },
        { id: 'br-4', number: '4', label: 'Mirror Check', codes: [c('A', 'Not in 10 sec')] },
        { id: 'br-5', number: '5', label: 'Lane', codes: [c('A', 'Wrong'), c('B', 'wanders'), c('C', 'obstacles')] },
        { id: 'br-6', number: '6', label: 'Speed', codes: [c('A', 'Over limit'), c('B', 'traffic'), c('C', 'uneven'), c('D', 'avoid obstacles')] },
        { id: 'br-7', number: '7', label: 'Spacing', codes: [c('A', '2-3 sec'), c('B', 'rear wheels'), c('C', 'sides'), c('D', 'blind spots'), c('E', 'inc. follow distance')] },
      ] }],
    },
    {
      id: 'expressway',
      label: 'Expressway',
      groups: [
        { id: 'entering', title: 'Entering:', items: [
          { id: 'exp-entering-1', number: '1', label: 'Traffic Check', codes: [c('A', 'No left-right'), c('B', 'mirrors')] },
          { id: 'exp-entering-2', number: '2', label: 'Traffic check', codes: [c('A', 'No Blind spot')] },
          { id: 'exp-entering-3', number: '3', label: 'Signal', codes: [c('A', 'Late'), c('B', 'never')] },
          { id: 'exp-entering-4', number: '4', label: 'Spacing', codes: [c('A', 'Not 2-3 sec front'), c('B', 'back'), c('C', 'out of acc. lane')] },
          { id: 'exp-entering-5', number: '5', label: 'Speed', codes: [c('A', 'Too fast'), c('B', 'slow'), c('C', 'accelerate after acc. lane')] },
          { id: 'exp-entering-6', number: '6', label: 'Merge', codes: [c('A', 'Sharp'), c('B', 'not to lane centre')] },
          { id: 'exp-entering-7', number: '7', label: 'Signal', codes: [c('A', 'On after 5 sec')] },
        ] },
        { id: 'exp-driving', title: 'Driving Along:', items: [
          { id: 'exp-driving-1', number: '1', label: 'Traffic Check', codes: [c('A', 'Not every 5 sec')] },
          { id: 'exp-driving-2', number: '2', label: 'Speed', codes: [c('A', 'Over limit'), c('B', 'not traffic speed'), c('C', 'uneven'), c('D', 'avoid obstacles')] },
          { id: 'exp-driving-3', number: '3', label: 'Spacing', codes: [c('A', 'Under 2-3 sec'), c('B', 'sides'), c('C', 'in blind spots'), c('D', 'not inc. follow dist')] },
        ] },
        { id: 'exiting', title: 'Exiting:', items: [
          { id: 'exp-exiting-1', number: '1', label: 'Traffic Check', codes: [c('A', 'No left-right'), c('B', 'mirrors'), c('C', 'blind spot')] },
          { id: 'exp-exiting-2', number: '2', label: 'Signal', codes: [c('A', 'None'), c('B', 'after exit lane')] },
          { id: 'exp-exiting-3', number: '3', label: 'Exit Lane', codes: [c('A', 'Over line'), c('B', 'after start of lane'), c('C', 'sharp turn to lane')] },
          { id: 'exp-exiting-4', number: '4', label: 'Speed', codes: [c('A', 'Slowed on expressway'), c('B', 'spacing'), c('C', 'rough slowing')] },
          { id: 'exp-exiting-5', number: '5', label: 'Gap', codes: [c('A', 'Under 2-3 sec front')] },
          { id: 'exp-exiting-6', number: '6', label: 'Signal', codes: [c('A', 'Still on at ramp end')] },
        ] },
      ],
    },
    {
      id: 'curve',
      label: 'Curve',
      groups: [{ id: 'curve', items: [
        { id: 'curve-1', number: '1', label: 'Speed', codes: [c('A', 'Braked'), c('B', 'too fast'), c('C', 'not steady speed'), c('D', 'changed gear')] },
        { id: 'curve-2', number: '2', label: 'Lane', codes: [c('A', 'Out of'), c('B', 'unsteady steering')] },
      ] }],
    },
    {
      id: 'stop-intersection',
      label: 'Stop Intersection',
      groups: [
        { id: 'si-approach', title: 'Approach:', items: [
          { id: 'si-approach-1', number: '1', label: 'Traffic Check', codes: [c('A', 'No mirrors')] },
          { id: 'si-approach-2', number: '2', label: 'Speed', codes: [c('A', 'Uneven'), c('B', 'brake'), c('C', 'gears'), c('D', 'coast')] },
          { id: 'si-approach-3', number: '3', label: 'Gap', codes: [c('A', 'Less than 2-3 sec')] },
        ] },
        { id: 'si-stopping', title: 'Stopping:', items: [
          { id: 'si-stopping-1', number: '1', label: 'Full Stop', codes: [c('A', 'No full stop'), c('B', 'roll'), c('C', 'blocked traffic')] },
          { id: 'si-stopping-2', number: '2', label: 'Position', codes: [c('A', 'Rear wheels'), c('B', 'over line')] },
          { id: 'si-stopping-3', number: '3', label: 'Traffic Check', codes: [c('A', 'none while waiting')] },
        ] },
        { id: 'si-starting', title: 'Starting:', items: [
          { id: 'si-starting-1', number: '1', label: 'Traffic Check', codes: [c('A', 'No left-right-left')] },
          { id: 'si-starting-2', number: '2', label: 'Hands-Gears', codes: [c('A', 'One hand'), c('B', 'gear change')] },
          { id: 'si-starting-3', number: '3', label: 'Traffic Check', codes: [c('A', 'not by traffic speed')] },
          { id: 'si-starting-4', number: '4', label: 'Speed', codes: [c('A', 'Wait'), c('B', 'fast'), c('C', 'slow'), c('D', 'lug'), c('E', 'rev'), c('F', 'gears')] },
        ] },
      ],
    },
    {
      id: 'through-intersection',
      label: 'Through Intersection',
      groups: [
        { id: 'ti-approach', title: 'Approach:', items: [
          { id: 'ti-approach-1', number: '1', label: 'Traffic Check', codes: [c('A', 'No left-right check')] },
          { id: 'ti-approach-2', number: '2', label: 'Traffic Check', codes: [c('A', 'No mirrors')] },
          { id: 'ti-approach-3', number: '3', label: 'Speed', codes: [c('A', 'Not keep speed'), c('B', 'not slow for hazard'), c('C', 'not cover brake')] },
          { id: 'ti-approach-4', number: '4', label: 'Gap', codes: [c('A', 'Less than 2-3 sec')] },
        ] },
        { id: 'ti-through', title: 'Through:', items: [
          { id: 'ti-through-1', number: '1', label: '', codes: [c('A', 'Lane change'), c('B', 'one hand'), c('C', 'gears')] },
          { id: 'ti-through-2', number: '2', label: 'Traffic Check', codes: [c('A', 'No mirrors')] },
        ] },
      ],
    },
  ],
  summaryReasonsLabel: 'Reason For Disqualification',
  summaryReasons: [
    'Preventable collision',
    'Dangerous Action',
    'Traffic law violation',
    'Inadequate skill to complete test',
    'Too many driving errors',
  ],
  examinerFlags: [],
};

export const EXAM_SHEETS: Record<string, ExamSheet> = {
  G2: G2_SHEET,
  G: G_SHEET,
};

export function getExamSheet(testType: EvaluationTestType): ExamSheet {
  return EXAM_SHEETS[testType] || G2_SHEET;
}

export function getExamSheetByVersion(version?: string): ExamSheet | null {
  if (!version) return null;
  return Object.values(EXAM_SHEETS).find(sheet => sheet.version === version) || null;
}

// Flat list of every markable item id for a sheet (used to seed a blank
// evaluation and to validate).
export function buildSheetItems(sheet: ExamSheet): EvaluationItem[] {
  const items: EvaluationItem[] = [];
  for (const section of sheet.sections) {
    for (const group of section.groups) {
      for (const item of group.items) {
        items.push({
          id: item.id,
          name: [section.label, group.title, item.label].filter(Boolean).join(' · '),
          status: 'ok',
          tags: [],
          category: section.id,
          marks: [],
        });
      }
    }
  }
  return items;
}
