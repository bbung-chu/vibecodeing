import { describe, expect, it } from "vitest";
import { monthWeeks, parseMonth, shiftMonth } from "@/features/events/month";

describe("month grid", () => {
  it("is Monday-first and covers October 2026", () => {
    const weeks = monthWeeks(2026, 10);
    expect(weeks[0][0].key).toBe("2026-09-28");
    expect(weeks[0][3]).toEqual({ key: "2026-10-01", day: 1, inMonth: true });
    expect(weeks.at(-1)![6].key).toBe("2026-11-01");
    expect(weeks).toHaveLength(5);
  });
  it("validates and shifts months", () => {
    expect(parseMonth("2026-13")).toBeNull();
    expect(parseMonth("abc")).toBeNull();
    expect(parseMonth(undefined)).toBeNull();
    expect(parseMonth("2026-10")).toEqual({ year: 2026, month: 10 });
    expect(shiftMonth(2026, 12, 1)).toBe("2027-01");
    expect(shiftMonth(2026, 1, -1)).toBe("2025-12");
  });
});
