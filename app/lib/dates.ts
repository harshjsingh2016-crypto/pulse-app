// Local-calendar-date helpers. Meal/workout/spend dates are stored as the user's
// LOCAL day (YYYY-MM-DD) — not UTC — so entries land on the day the user actually
// experienced them, and match what the chat context uses via `clientDate`.

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** The local calendar date (YYYY-MM-DD) for a given Date (defaults to now). */
export function todayStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Adds `days` to a YYYY-MM-DD date string, returning a local YYYY-MM-DD string. */
export function offsetDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return todayStr(d);
}
