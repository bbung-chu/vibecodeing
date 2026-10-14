import type { AppEvent, Course, Slot } from './types';

const DAY_MS = 86_400_000;
const kstFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function kstDateKey(at: Date): string {
  return kstFormat.format(at);
}

function keyToUtcMs(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function ddayCount(target: Date, now: Date): number {
  return Math.round((keyToUtcMs(kstDateKey(target)) - keyToUtcMs(kstDateKey(now))) / DAY_MS);
}

export function formatDday(n: number): string {
  if (n === 0) return 'D-day';
  return n > 0 ? `D-${n}` : `D+${-n}`;
}

export function upcomingEvents(events: AppEvent[], now: Date, days = 30): AppEvent[] {
  return events
    .filter((e) => {
      const diff = ddayCount(new Date(e.startsAt), now);
      return diff >= 0 && diff <= days;
    })
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

/** 1=월 … 7=일 */
export function kstWeekday(at: Date): number {
  const day = new Date(keyToUtcMs(kstDateKey(at))).getUTCDay();
  return day === 0 ? 7 : day;
}

export function todayClasses(courses: Course[], now: Date): { course: Course; slot: Slot }[] {
  const weekday = kstWeekday(now);
  return courses
    .flatMap((course) => course.slots.filter((s) => s.dayOfWeek === weekday).map((slot) => ({ course, slot })))
    .sort((a, b) => a.slot.start.localeCompare(b.slot.start));
}
