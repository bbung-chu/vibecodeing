const DAY_MS = 86_400_000;

export type MonthCell = { key: string; day: number; inMonth: boolean };

const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** "YYYY-MM" if valid, else null. */
export function parseMonth(value: string | undefined): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(value ?? "");
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  return year >= 1970 && year <= 2999 && month >= 1 && month <= 12 ? { year, month } : null;
}

export function shiftMonth(year: number, month: number, delta: number): string {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

/** Monday-first weeks (7 cells each) covering the month, keyed by date "YYYY-MM-DD". */
export function monthWeeks(year: number, month: number): MonthCell[][] {
  const first = Date.UTC(year, month - 1, 1);
  const last = Date.UTC(year, month, 0);
  const start = first - ((new Date(first).getUTCDay() + 6) % 7) * DAY_MS;
  const weeks: MonthCell[][] = [];
  for (let weekStart = start; weekStart <= last; weekStart += 7 * DAY_MS) {
    weeks.push(
      Array.from({ length: 7 }, (_, i) => {
        const ms = weekStart + i * DAY_MS;
        const d = new Date(ms);
        return { key: keyOf(ms), day: d.getUTCDate(), inMonth: d.getUTCMonth() === month - 1 };
      }),
    );
  }
  return weeks;
}
