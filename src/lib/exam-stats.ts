import { addMonths, endOfMonth, startOfMonth } from 'date-fns';
import type { CalendarEvent } from './types';

type ExamLike = Pick<CalendarEvent, 'start' | 'title' | 'services' | 'lessonStatus' | 'examCenter' | 'examDateTime' | 'examImageDataUri' | 'examResult'>;

/** Road tests are booked through the exam scheduler (exam fields) or as a lesson with an exam/road test service. */
export function isExamEvent(event: ExamLike): boolean {
  return Boolean(
    event.examCenter ||
    event.examDateTime ||
    event.examImageDataUri ||
    event.title?.toLowerCase().includes('exam') ||
    event.services?.some(service => /exam|road test/i.test(service.name || ''))
  );
}

/** The exam's own time when known; the booking block starts earlier for pickup and warm-up. */
export function getExamTime(event: ExamLike): Date {
  const examTime = event.examDateTime ? new Date(event.examDateTime) : null;
  return examTime && !Number.isNaN(examTime.getTime()) ? examTime : new Date(event.start);
}

export type ExamMonthStats = {
  monthStart: Date;
  /** Every exam booked in the month, except cancelled ones. */
  scheduled: number;
  /** Exam time has passed and the student wasn't marked no-show. */
  done: number;
  /** Exam time is still ahead. */
  upcoming: number;
  noShow: number;
  cancelled: number;
  passed: number;
  failed: number;
  /** Done exams with no pass/fail recorded yet. */
  awaitingResult: number;
};

export function getExamMonthStats(events: ExamLike[], monthOffset: number, now = new Date()): ExamMonthStats {
  const monthStart = startOfMonth(addMonths(now, monthOffset));
  const monthEnd = endOfMonth(monthStart);
  const stats: ExamMonthStats = {
    monthStart, scheduled: 0, done: 0, upcoming: 0, noShow: 0, cancelled: 0, passed: 0, failed: 0, awaitingResult: 0,
  };

  for (const event of events) {
    if (!isExamEvent(event)) continue;
    const examTime = getExamTime(event);
    if (Number.isNaN(examTime.getTime()) || examTime < monthStart || examTime > monthEnd) continue;

    const status = event.lessonStatus || 'scheduled';
    if (status === 'cancelled') {
      stats.cancelled += 1;
      continue;
    }
    stats.scheduled += 1;
    if (status === 'no-show') stats.noShow += 1;
    else if (examTime.getTime() <= now.getTime()) {
      stats.done += 1;
      if (event.examResult === 'passed') stats.passed += 1;
      else if (event.examResult === 'failed') stats.failed += 1;
      else stats.awaitingResult += 1;
    } else stats.upcoming += 1;
  }

  return stats;
}

/** Share of exams with a recorded result that passed, as a whole percent; null when none are recorded. */
export function getPassRate(stats: Pick<ExamMonthStats, 'passed' | 'failed'>): number | null {
  const recorded = stats.passed + stats.failed;
  return recorded > 0 ? Math.round((stats.passed / recorded) * 100) : null;
}

/** All exams still ahead, across every month. */
export function countUpcomingExams(events: ExamLike[], now = new Date()): number {
  return events.filter(event => (
    isExamEvent(event) &&
    (event.lessonStatus || 'scheduled') === 'scheduled' &&
    getExamTime(event).getTime() > now.getTime()
  )).length;
}
