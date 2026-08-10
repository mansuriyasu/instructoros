import { ScheduleCandidate, ScheduleLockedEvent, ScheduleProposal } from '@/lib/types';
import { estimateTravelTimeSafe } from '@/ai/flows/estimate-travel-time';
import crypto from 'node:crypto';

// A deterministic greedy solver
export async function solveScheduleDeterministic(
  candidates: ScheduleCandidate[],
  dateStr: string,
  startHour: number = 9,
  endHour: number = 17,
  lockedEvents: ScheduleLockedEvent[] = []
): Promise<ScheduleProposal> {
  const planned = [] as ScheduleProposal['candidates'];
  const exclusions: { studentId: string; reason: string }[] = [];
  const travelCache = new Map<string, number>();
  const dayStart = new Date(`${dateStr}T${startHour.toString().padStart(2, '0')}:00:00-04:00`);
  const endOfDay = new Date(`${dateStr}T${endHour.toString().padStart(2, '0')}:00:00-04:00`);
  const fixed = lockedEvents
    .map(event => ({ ...event, startDate: new Date(event.start), endDate: new Date(event.end) }))
    .filter(event => Number.isFinite(event.startDate.getTime()) && Number.isFinite(event.endDate.getTime()) && event.endDate > event.startDate)
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  const travelMinutes = async (origin: string, destination: string) => {
    if (!origin || !destination || origin.trim().toLowerCase() === destination.trim().toLowerCase()) return 0;
    const key = `${origin.trim().toLowerCase()}|${destination.trim().toLowerCase()}`;
    const reverseKey = `${destination.trim().toLowerCase()}|${origin.trim().toLowerCase()}`;
    const cached = travelCache.get(key) ?? travelCache.get(reverseKey);
    if (cached !== undefined) return cached;
    const estimate = await estimateTravelTimeSafe(origin, destination);
    const minutes = estimate.ok && Number.isFinite(estimate.details.travelTimeMinutes)
      ? Math.max(0, Math.round(estimate.details.travelTimeMinutes))
      : 30;
    travelCache.set(key, minutes);
    return minutes;
  };

  const unassigned = [...candidates];
  let currentAddress = '';
  let currentTime = dayStart;
  let totalTravelMinutes = 0;
  let totalDuration = 0;

  while (unassigned.length > 0 && currentTime < endOfDay) {
    type Option = { index: number; start: Date; end: Date; travel: number; buffer: number };
    const options: Option[] = [];

    for (let index = 0; index < unassigned.length; index += 1) {
      const candidate = unassigned[index];
      let cursor = new Date(currentTime);
      let origin = currentAddress;
      let option: Option | null = null;

      for (let attempt = 0; attempt <= fixed.length + 1; attempt += 1) {
        const nextFixed = fixed.find(event => event.endDate > cursor);
        const travel = await travelMinutes(origin, candidate.studentAddress);
        const buffer = origin ? 5 : 0;
        const earliest = new Date(cursor.getTime() + (travel + buffer) * 60000);

        for (const window of candidate.availableWindows) {
          const windowStart = new Date(window.start);
          const windowEnd = new Date(window.end);
          const proposedStart = new Date(Math.max(earliest.getTime(), windowStart.getTime()));
          const proposedEnd = new Date(proposedStart.getTime() + candidate.duration * 60000);
          if (proposedEnd > windowEnd || proposedEnd > endOfDay) continue;
          if (nextFixed && proposedStart < nextFixed.endDate && proposedEnd > nextFixed.startDate) continue;

          if (nextFixed && nextFixed.startDate > proposedEnd && nextFixed.address) {
            const toFixed = await travelMinutes(candidate.studentAddress, nextFixed.address);
            if (new Date(proposedEnd.getTime() + (toFixed + 5) * 60000) > nextFixed.startDate) continue;
          }
          option = { index, start: proposedStart, end: proposedEnd, travel, buffer };
          break;
        }
        if (option || !nextFixed) break;

        // The candidate did not fit before the next locked event; continue after it.
        cursor = new Date(nextFixed.endDate);
        origin = nextFixed.address || '';
      }
      if (option) options.push(option);
    }

    if (options.length === 0) {
      for (const left of unassigned) {
        exclusions.push({ studentId: left.studentId, reason: 'No feasible slot fits the availability, locked schedule, travel time, and lesson duration.' });
      }
      unassigned.splice(0);
      break;
    }
    options.sort((left, right) => left.start.getTime() - right.start.getTime() || left.travel - right.travel);
    const chosen = options[0];
    const candidate = unassigned.splice(chosen.index, 1)[0];
    totalTravelMinutes += chosen.travel;
    totalDuration += candidate.duration;
    currentAddress = candidate.studentAddress;
    currentTime = chosen.end;
    planned.push({
      eventId: `ai-${crypto.randomUUID()}`,
      studentId: candidate.studentId,
      studentName: candidate.studentName,
      studentAddress: candidate.studentAddress,
      serviceId: candidate.serviceId,
      serviceName: candidate.serviceName || 'Driving lesson',
      servicePrice: candidate.servicePrice,
      serviceCost: candidate.serviceCost,
      serviceDiscount: candidate.serviceDiscount,
      suggestedStartTime: chosen.start.toISOString(),
      suggestedEndTime: chosen.end.toISOString(),
      travelMinutes: chosen.travel,
      bufferMinutes: chosen.buffer,
    });
  }

  if (unassigned.length > 0) {
    for (const left of unassigned) {
      exclusions.push({ studentId: left.studentId, reason: 'Ran out of time in the working day.' });
    }
  }

  return {
    id: `prop-${Math.random().toString(36).substr(2, 9)}`,
    candidates: planned,
    totalTravelMinutes,
    totalDuration,
    exclusions,
    explanation: 'The proposal respects student windows, locked events, lesson duration, estimated travel, and a five-minute buffer.',
  };
}
