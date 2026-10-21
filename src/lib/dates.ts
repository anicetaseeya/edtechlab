// Everything a student sees is in Europe/Madrid time.

export const MADRID = "Europe/Madrid";

/** Today in Madrid, as YYYY-MM-DD. */
export function madridToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MADRID,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Add days to a YYYY-MM-DD string (calendar maths, no time zone drift). */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** The default date for a new entry: 7 days from today. */
export function defaultEntryDate(): string {
  return addDays(madridToday(), 7);
}

/** "Thu 23 Oct" */
export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** "18:00" from "18:00:00" */
export function formatTime(time: string | null): string | null {
  if (!time) return null;
  return time.slice(0, 5);
}

/** "Thu 18:00", used for the "was ..." note on a moved entry. */
export function shortWhen(isoDate: string, time: string | null): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const day = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "short",
  }).format(new Date(Date.UTC(y, m - 1, d)));
  const t = formatTime(time);
  return t ? `${day} ${t}` : day;
}

/** Monday-first list of the 7 days starting this week, as YYYY-MM-DD. */
export function thisWeekDays(): string[] {
  const today = madridToday();
  const [y, m, d] = today.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = (dt.getUTCDay() + 6) % 7; // 0 = Monday
  const monday = addDays(today, -dow);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** "in 6 days", "in 4 hours", "today", "passed" */
export function countdown(iso: string, now: Date = new Date()): string {
  const ms = new Date(iso).getTime() - now.getTime();
  if (ms <= 0) return "passed";
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `in ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `in ${hours} ${hours === 1 ? "hour" : "hours"}`;
  const days = Math.floor(hours / 24);
  return `in ${days} ${days === 1 ? "day" : "days"}`;
}

/** "Thu 23 Oct, 18:00 (Madrid)" for a full timestamp. */
export function formatStamp(iso: string): string {
  return (
    new Intl.DateTimeFormat("en-GB", {
      timeZone: MADRID,
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso)) + " (Madrid)"
  );
}
