import type { Slot } from './types';

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function validateSlot(s: Slot): string | null {
  if (!Number.isInteger(s.dayOfWeek) || s.dayOfWeek < 1 || s.dayOfWeek > 5) {
    return '수업은 월요일부터 금요일까지만 넣을 수 있어요';
  }
  if (toMinutes(s.start) >= toMinutes(s.end)) {
    return '시작 시간이 끝 시간보다 빨라야 해요';
  }
  return null;
}

export function findOverlaps(candidate: Slot[], existing: Slot[]): Slot[] {
  return existing.filter((e) =>
    candidate.some(
      (c) =>
        c.dayOfWeek === e.dayOfWeek &&
        !(c.courseId !== undefined && c.courseId === e.courseId) &&
        toMinutes(c.start) < toMinutes(e.end) &&
        toMinutes(e.start) < toMinutes(c.end),
    ),
  );
}

export function timetableRange(slots: Slot[]): { startHour: number; endHour: number } {
  let startHour = 9;
  let endHour = 18;
  for (const s of slots) {
    startHour = Math.min(startHour, Math.floor(toMinutes(s.start) / 60));
    endHour = Math.max(endHour, Math.ceil(toMinutes(s.end) / 60));
  }
  return { startHour, endHour };
}
