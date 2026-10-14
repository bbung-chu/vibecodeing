import { describe, expect, it } from 'vitest';
import { ddayCount, formatDday, kstDateKey, kstWeekday, todayClasses, upcomingEvents } from '@/lib/domain/dday';
import type { AppEvent, Course } from '@/lib/domain/types';

const now = new Date('2026-10-14T15:30:00Z'); // 2026-10-15 00:30 KST (Thursday)

const ev = (id: string, startsAt: string): AppEvent => ({ id, courseId: null, kind: 'personal', title: id, startsAt });

describe('kstDateKey / ddayCount / formatDday', () => {
  it('uses the KST date', () => {
    expect(kstDateKey(now)).toBe('2026-10-15');
  });
  it('counts KST calendar days', () => {
    expect(ddayCount(new Date('2026-10-15T14:59:00Z'), now)).toBe(0);
    expect(ddayCount(new Date('2026-10-15T15:00:00Z'), now)).toBe(1);
    expect(ddayCount(new Date('2026-10-13T00:00:00Z'), now)).toBe(-2);
  });
  it('formats D-day labels', () => {
    expect([0, 3, -2].map(formatDday)).toEqual(['D-day', 'D-3', 'D+2']);
  });
});

describe('upcomingEvents', () => {
  it('filters to today..today+30 KST days and sorts ascending', () => {
    const yesterday = ev('yesterday', '2026-10-14T14:00:00Z'); // 10-14 23:00 KST
    const today = ev('today', '2026-10-15T14:59:00Z'); // 10-15 23:59 KST
    const plus30 = ev('plus30', '2026-11-14T14:30:00Z'); // 11-14 23:30 KST
    const plus31 = ev('plus31', '2026-11-14T15:00:00Z'); // 11-15 00:00 KST
    const near = ev('near', '2026-10-20T14:30:00Z'); // 10-20 23:30 KST
    const out = upcomingEvents([plus30, yesterday, plus31, near, today], now);
    expect(out.map((e) => e.id)).toEqual(['today', 'near', 'plus30']);
  });
  it('honours a custom days window', () => {
    const e = ev('a', '2026-10-18T00:00:00Z');
    expect(upcomingEvents([e], now, 2)).toEqual([]);
    expect(upcomingEvents([e], now, 3)).toEqual([e]);
  });
});

describe('kstWeekday / todayClasses', () => {
  const course = (id: string, slots: Course['slots']): Course => ({
    id, semesterId: 's', name: id, professor: null, room: null, color: '#000', slots,
  });
  const courses = [
    course('late', [{ dayOfWeek: 4, start: '13:00', end: '14:00' }]),
    course('early', [{ dayOfWeek: 4, start: '09:00', end: '10:00' }, { dayOfWeek: 2, start: '08:00', end: '09:00' }]),
    course('other', [{ dayOfWeek: 1, start: '09:00', end: '10:00' }]),
  ];
  it('maps weekdays 1=Mon..7=Sun in KST', () => {
    expect(kstWeekday(now)).toBe(4);
    expect(kstWeekday(new Date('2026-10-17T03:00:00Z'))).toBe(6);
    expect(kstWeekday(new Date('2026-10-18T03:00:00Z'))).toBe(7);
    expect(kstWeekday(new Date('2026-10-18T15:00:00Z'))).toBe(1); // Mon 00:00 KST
  });
  it('returns Thursday slots sorted by start', () => {
    const out = todayClasses(courses, now);
    expect(out.map((x) => [x.course.id, x.slot.start])).toEqual([['early', '09:00'], ['late', '13:00']]);
  });
  it('returns [] on Saturday', () => {
    expect(todayClasses(courses, new Date('2026-10-17T03:00:00Z'))).toEqual([]);
  });
});
