import { describe, expect, it } from 'vitest';
import { findOverlaps, timetableRange, validateSlot } from '@/lib/domain/slots';
import type { DayOfWeek } from '@/lib/domain/types';

describe('validateSlot', () => {
  it('rejects start not before end', () => {
    expect(validateSlot({ dayOfWeek: 1, start: '12:00', end: '10:30' })).toBe('시작 시간이 끝 시간보다 빨라야 해요');
    expect(validateSlot({ dayOfWeek: 1, start: '10:00', end: '10:00' })).toBe('시작 시간이 끝 시간보다 빨라야 해요');
  });
  it('rejects days outside 1..5, taking precedence over time order', () => {
    expect(validateSlot({ dayOfWeek: 6 as DayOfWeek, start: '09:00', end: '10:00' })).toBe('수업은 월요일부터 금요일까지만 넣을 수 있어요');
    expect(validateSlot({ dayOfWeek: 0 as DayOfWeek, start: '12:00', end: '10:00' })).toBe('수업은 월요일부터 금요일까지만 넣을 수 있어요');
  });
  it('accepts a valid slot', () => {
    expect(validateSlot({ dayOfWeek: 1, start: '09:00', end: '10:30' })).toBeNull();
  });
});

describe('findOverlaps', () => {
  const ex = [{ courseId: 'a', dayOfWeek: 1 as DayOfWeek, start: '10:30', end: '12:00' }];
  it('finds overlapping slots', () => {
    expect(findOverlaps([{ dayOfWeek: 1, start: '11:00', end: '12:30' }], ex)).toHaveLength(1);
  });
  it('treats touching ends as non-overlapping', () => {
    expect(findOverlaps([{ dayOfWeek: 1, start: '12:00', end: '13:00' }], ex)).toHaveLength(0);
  });
  it('ignores other days', () => {
    expect(findOverlaps([{ dayOfWeek: 2, start: '11:00', end: '12:30' }], ex)).toHaveLength(0);
  });
  it('ignores existing slots of the same course', () => {
    expect(findOverlaps([{ courseId: 'a', dayOfWeek: 1, start: '11:00', end: '12:00' }], ex)).toHaveLength(0);
  });
  it('returns each existing slot once even if several candidates hit it', () => {
    const cands = [
      { dayOfWeek: 1 as DayOfWeek, start: '10:00', end: '11:00' },
      { dayOfWeek: 1 as DayOfWeek, start: '11:00', end: '11:30' },
    ];
    expect(findOverlaps(cands, ex)).toHaveLength(1);
  });
});

describe('timetableRange', () => {
  it('defaults to 9-18', () => {
    expect(timetableRange([])).toEqual({ startHour: 9, endHour: 18 });
  });
  it('extends to fit', () => {
    expect(timetableRange([{ dayOfWeek: 1, start: '08:30', end: '19:15' }])).toEqual({ startHour: 8, endHour: 20 });
    expect(timetableRange([{ dayOfWeek: 1, start: '10:00', end: '19:00' }])).toEqual({ startHour: 9, endHour: 19 });
  });
});
