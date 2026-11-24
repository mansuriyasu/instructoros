import { test, describe } from 'node:test';
import assert from 'node:assert';
import { countUpcomingExams, getExamMonthStats, getPassRate, isExamEvent } from '../src/lib/exam-stats';

const now = new Date('2026-11-24T12:00:00');
const exam = (examDateTime: string, lessonStatus?: 'scheduled' | 'no-show' | 'cancelled') => ({
  start: examDateTime,
  title: 'Ali • G2 • 10:00 AM',
  services: [],
  examCenter: 'Port Union DriveTest',
  examDateTime,
  lessonStatus,
});
const lesson = { start: '2026-11-10T10:00:00', title: 'Ali', services: [{ id: 's', name: 'G2 Lesson' }] };

describe('exam stats', () => {
  const events = [
    exam('2026-10-15T10:00:00'),
    exam('2026-11-05T10:00:00'),
    exam('2026-11-12T10:00:00', 'no-show'),
    exam('2026-11-18T10:00:00', 'cancelled'),
    exam('2026-11-28T10:00:00'),
    exam('2026-12-03T10:00:00'),
    { start: '2026-12-09T10:00:00', title: 'Sara', services: [{ id: 'r', name: 'G Road Test' }] },
    lesson,
  ];

  test('detects exams and ignores normal lessons', () => {
    assert.strictEqual(isExamEvent(lesson), false);
    assert.strictEqual(isExamEvent(events[6]), true);
  });

  test('this month splits done, upcoming, no-show and cancelled', () => {
    const stats = getExamMonthStats(events, 0, now);
    assert.deepStrictEqual(
      { scheduled: stats.scheduled, done: stats.done, upcoming: stats.upcoming, noShow: stats.noShow, cancelled: stats.cancelled },
      { scheduled: 3, done: 1, upcoming: 1, noShow: 1, cancelled: 1 }
    );
  });

  test('last and next month', () => {
    assert.strictEqual(getExamMonthStats(events, -1, now).done, 1);
    const next = getExamMonthStats(events, 1, now);
    assert.strictEqual(next.scheduled, 2);
    assert.strictEqual(next.upcoming, 2);
  });

  test('upcoming total counts every future exam', () => {
    assert.strictEqual(countUpcomingExams(events, now), 3);
  });

  test('pass rate counts only recorded results', () => {
    const withResults = [
      { ...exam('2026-11-03T10:00:00'), examResult: 'passed' as const },
      { ...exam('2026-11-04T10:00:00'), examResult: 'passed' as const },
      { ...exam('2026-11-06T10:00:00'), examResult: 'failed' as const },
      exam('2026-11-07T10:00:00'),
    ];
    const stats = getExamMonthStats(withResults, 0, now);
    assert.deepStrictEqual(
      { passed: stats.passed, failed: stats.failed, awaitingResult: stats.awaitingResult },
      { passed: 2, failed: 1, awaitingResult: 1 }
    );
    assert.strictEqual(getPassRate(stats), 67);
    assert.strictEqual(getPassRate({ passed: 0, failed: 0 }), null);
  });
});
