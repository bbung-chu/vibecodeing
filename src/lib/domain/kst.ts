const KST_OFFSET_MS = 9 * 3_600_000;
const LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** "YYYY-MM-DDTHH:MM" entered as KST wall-clock time -> UTC ISO string. Throws if malformed. */
export function kstLocalToUtcIso(local: string): string {
  const m = LOCAL.exec(local);
  if (!m) throw new Error(`Invalid KST datetime: ${local}`);
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const wall = new Date(Date.UTC(y, mo - 1, d, h, mi));
  // Reject overflow such as month 13, Feb 30 or hour 25 (Date.UTC would silently roll over).
  if (
    wall.getUTCFullYear() !== y || wall.getUTCMonth() !== mo - 1 || wall.getUTCDate() !== d ||
    wall.getUTCHours() !== h || wall.getUTCMinutes() !== mi
  ) {
    throw new Error(`Invalid KST datetime: ${local}`);
  }
  return new Date(wall.getTime() - KST_OFFSET_MS).toISOString();
}

/** UTC ISO string -> "YYYY-MM-DDTHH:MM" in KST (for datetime-local inputs). Throws if malformed. */
export function utcIsoToKstLocal(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new Error(`Invalid ISO datetime: ${iso}`);
  return new Date(ms + KST_OFFSET_MS).toISOString().slice(0, 16);
}
