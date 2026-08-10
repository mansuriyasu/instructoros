import { test, describe } from 'node:test';
import assert from 'node:assert';
import { solveScheduleDeterministic } from '../src/ai/flows/solve-schedule';
import { ScheduleCandidate } from '../src/lib/types';

describe('solveScheduleDeterministic', () => {
  const baseCandidate: ScheduleCandidate = {
    studentId: 's1',
    studentName: 'Student One',
    studentAddress: '123 Test St',
    serviceId: 'service1',
    duration: 60,
    availableWindows: []
  };

  test('schedules a single candidate within available window', async () => {
    const candidate: ScheduleCandidate = {
      ...baseCandidate,
      availableWindows: [
        { start: '2026-08-11T09:00:00-04:00', end: '2026-08-11T12:00:00-04:00' }
      ]
    };

    const result = await solveScheduleDeterministic([candidate], '2026-08-11', 9, 17);
    assert.strictEqual(result.candidates.length, 1);
    assert.strictEqual(result.exclusions.length, 0);
    assert.strictEqual(result.totalDuration, 60);
    const start = new Date(result.candidates[0].suggestedStartTime);
    // Since input is -04:00, 09:00 is 13:00 UTC
    assert.strictEqual(start.getUTCHours(), 13);
  });

  test('excludes candidate if available window is too short (boundary duration)', async () => {
    const candidate: ScheduleCandidate = {
      ...baseCandidate,
      duration: 90,
      availableWindows: [
        { start: '2026-08-11T09:00:00-04:00', end: '2026-08-11T10:00:00-04:00' } // only 60 mins
      ]
    };

    const result = await solveScheduleDeterministic([candidate], '2026-08-11', 9, 17);
    assert.strictEqual(result.candidates.length, 0);
    assert.strictEqual(result.exclusions.length, 1);
    assert.match(result.exclusions[0].reason, /overlap|availability/i);
  });

  test('adds travel time and buffer between consecutive lessons', async () => {
    const c1: ScheduleCandidate = {
      ...baseCandidate,
      studentId: 's1',
      studentAddress: 'Address 1',
      availableWindows: [{ start: '2026-08-11T09:00:00-04:00', end: '2026-08-11T17:00:00-04:00' }]
    };
    const c2: ScheduleCandidate = {
      ...baseCandidate,
      studentId: 's2',
      studentAddress: 'Address 2',
      availableWindows: [{ start: '2026-08-11T09:00:00-04:00', end: '2026-08-11T17:00:00-04:00' }]
    };

    const result = await solveScheduleDeterministic([c1, c2], '2026-08-11', 9, 17);
    assert.strictEqual(result.candidates.length, 2);

    // First candidate should start at 09:00, no travel buffer
    const first = result.candidates[0];
    assert.strictEqual(first.bufferMinutes, 0);

    // Without a configured travel provider, the safe fallback is 30 minutes.
    const second = result.candidates[1];
    assert.strictEqual(second.travelMinutes, 30);
    assert.strictEqual(second.bufferMinutes, 5);
    const start2 = new Date(second.suggestedStartTime);
    assert.strictEqual(start2.getHours(), 10);
    assert.strictEqual(start2.getMinutes(), 35);
  });

  test('excludes candidate if travel time pushes them outside available window', async () => {
    const c1: ScheduleCandidate = {
      ...baseCandidate,
      studentId: 's1',
      studentAddress: 'Addr 1',
      availableWindows: [{ start: '2026-08-11T09:00:00-04:00', end: '2026-08-11T10:00:00-04:00' }]
    };
    const c2: ScheduleCandidate = {
      ...baseCandidate,
      studentId: 's2',
      studentAddress: 'Addr 2',
      // s2 is available from 10:00 to 11:00. But travel (15) + buffer (5) means it can't start until 10:20
      // 10:20 + 60m = 11:20 which is > 11:00
      availableWindows: [{ start: '2026-08-11T10:00:00-04:00', end: '2026-08-11T11:00:00-04:00' }]
    };

    const result = await solveScheduleDeterministic([c1, c2], '2026-08-11', 9, 17);
    assert.strictEqual(result.candidates.length, 1);
    assert.strictEqual(result.candidates[0].studentId, 's1');
    assert.strictEqual(result.exclusions.length, 1);
    assert.strictEqual(result.exclusions[0].studentId, 's2');
  });

  test('excludes candidate if working day ends', async () => {
    const c1: ScheduleCandidate = {
      ...baseCandidate,
      duration: 120, // 2 hours
      availableWindows: [{ start: '2026-08-11T15:00:00-04:00', end: '2026-08-11T17:00:00-04:00' }]
    };
    const c2: ScheduleCandidate = {
      ...baseCandidate,
      duration: 60,
      availableWindows: [{ start: '2026-08-11T16:00:00-04:00', end: '2026-08-11T17:00:00-04:00' }]
    };

    // Setting the start hour to 15 (3 PM)
    const result = await solveScheduleDeterministic([c1, c2], '2026-08-11', 15, 17);

    // c1 will take 15:00 to 17:00.
    // c2 will try to start at 17:20 (17:00 + 15 + 5), which exceeds 17:00 end of day
    assert.strictEqual(result.candidates.length, 1);
    assert.strictEqual(result.exclusions.length, 1);
    assert.match(result.exclusions[0].reason, /feasible slot|working day/i);
  });
});
