// ISO calendar dates ('2026-11-14') as plain strings; arithmetic in UTC so no DST/timezone drift.

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar date in YYYY-MM-DD form. */
export function isIsoDate(s: string): boolean {
  const date = new Date(`${s}T00:00:00Z`);
  return ISO.test(s) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === s;
}

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Today's date at the resort (Asia/Kolkata). */
export function todayIST(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
}

/** Friday and Saturday nights (A14). */
export function isWeekendNight(iso: string): boolean {
  const day = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return day === 5 || day === 6;
}
