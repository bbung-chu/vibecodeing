import { describe, expect, it } from 'vitest';
import { kstLocalToUtcIso, utcIsoToKstLocal } from '@/lib/domain/kst';

describe('kst', () => {
  it('converts KST local to UTC ISO', () => {
    expect(kstLocalToUtcIso('2026-10-20T10:00')).toBe('2026-10-20T01:00:00.000Z');
    expect(kstLocalToUtcIso('2026-10-20T23:30')).toBe('2026-10-20T14:30:00.000Z');
    expect(kstLocalToUtcIso('2026-10-20T00:15')).toBe('2026-10-19T15:15:00.000Z');
  });
  it('converts UTC ISO back to KST local', () => {
    expect(utcIsoToKstLocal('2026-10-20T01:00:00.000Z')).toBe('2026-10-20T10:00');
    expect(utcIsoToKstLocal('2026-10-19T15:15:00+00:00')).toBe('2026-10-20T00:15');
  });
  it('round-trips', () => {
    expect(utcIsoToKstLocal(kstLocalToUtcIso('2026-12-31T23:59'))).toBe('2026-12-31T23:59');
  });
  it('throws on malformed input', () => {
    for (const bad of ['', 'abc', '2026-10-20', '2026-10-20 10:00', '2026-13-20T10:00', '2026-02-30T10:00', '2026-10-20T25:00']) {
      expect(() => kstLocalToUtcIso(bad)).toThrow();
    }
    expect(() => utcIsoToKstLocal('nope')).toThrow();
  });
});
