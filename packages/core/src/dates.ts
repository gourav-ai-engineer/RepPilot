import type { Weekday } from './types';

/** Parses a YYYY-MM-DD string as a UTC date so weekday maths ignores time zones. */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) throw new Error(`Invalid ISO date: ${iso}`);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Local calendar date of a JS Date as YYYY-MM-DD (what the user sees as "today"). */
export function localISODate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Monday = 0 … Sunday = 6 */
export function weekdayOf(iso: string): Weekday {
  return ((parseISODate(iso).getUTCDay() + 6) % 7) as Weekday;
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

export function mondayOf(iso: string): string {
  return addDays(iso, -weekdayOf(iso));
}

export function dateOfWeekday(weekStart: string, day: Weekday): string {
  return addDays(weekStart, day);
}
