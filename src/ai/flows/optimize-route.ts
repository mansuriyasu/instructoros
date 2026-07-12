'use server';

import { estimateTravelTimeSafe } from './estimate-travel-time';
export type RouteOptimization = {
  optimizedOrder: Array<{
    eventId: string;
    suggestedStartTime: string;
    suggestedEndTime: string;
    travelMinutes: number;
    bufferMinutes: number;
    explanation: string;
  }>;
};

export type OptimizeRouteResult = 
  | { ok: true; details: RouteOptimization }
  | { ok: false; error: string };

export async function optimizeDailyRoute(
  events: Array<{ id: string; studentName: string; address: string; originalStart: string; originalEnd: string; durationMinutes: number }>,
  startAddress?: string
): Promise<RouteOptimization> {
  const orderedEvents = [...events].sort(
    (a, b) => new Date(a.originalStart).getTime() - new Date(b.originalStart).getTime()
  );
  const bufferMinutes = 5;
  const optimizedOrder: RouteOptimization['optimizedOrder'] = [];
  let previousAddress = startAddress?.trim() || '';
  let previousEnd = new Date(orderedEvents[0]?.originalStart || Date.now());

  for (const [index, event] of orderedEvents.entries()) {
    const durationMinutes = Math.max(1, Math.round(event.durationMinutes));
    let travelMinutes = 0;

    if (index > 0 || previousAddress) {
      const origin = previousAddress || orderedEvents[index - 1]?.address || event.address;
      const estimate = await estimateTravelTimeSafe(origin, event.address);
      travelMinutes = estimate.ok && Number.isFinite(estimate.details.travelTimeMinutes)
        ? Math.max(0, Math.round(estimate.details.travelTimeMinutes))
        : 30;
    }

    const originalStart = new Date(event.originalStart);
    const suggestedStart = index === 0
      ? originalStart
      : new Date(previousEnd.getTime() + (travelMinutes + bufferMinutes) * 60000);
    const suggestedEnd = new Date(suggestedStart.getTime() + durationMinutes * 60000);

    optimizedOrder.push({
      eventId: event.id,
      suggestedStartTime: suggestedStart.toISOString(),
      suggestedEndTime: suggestedEnd.toISOString(),
      travelMinutes,
      bufferMinutes,
      explanation: index === 0
        ? 'First lesson keeps its original start time.'
        : `${travelMinutes} min estimated drive from the previous address + ${bufferMinutes} min buffer.`,
    });

    previousAddress = event.address;
    previousEnd = suggestedEnd;
  }

  return { optimizedOrder };
}

export async function optimizeDailyRouteSafe(
  events: Array<{ id: string; studentName: string; address: string; originalStart: string; originalEnd: string; durationMinutes: number }>,
  startAddress?: string
): Promise<OptimizeRouteResult> {
  try {
    const details = await optimizeDailyRoute(events, startAddress);
    return { ok: true, details };
  } catch (error) {
    console.error('AI route optimization failed:', error);
    return { ok: false, error: 'Could not optimize route.' };
  }
}
