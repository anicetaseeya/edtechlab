import { MADRID } from "./dates";

function madridOffsetMs(at: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: MADRID,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;

  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - at.getTime();
}

/** A Madrid wall-clock date+time as a real instant. */
function madridToUtc(isoDate: string, time: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const off1 = madridOffsetMs(new Date(guess));
  let real = guess - off1;
  const off2 = madridOffsetMs(new Date(real));
  if (off2 !== off1) real = guess - off2;
  return new Date(real);
}

function stampUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

export type IcsInput = {
  uid: string;
  title: string;
  date: string; // YYYY-MM-DD, Madrid
  time?: string | null; // HH:MM, Madrid
  location?: string | null;
  description?: string | null;
  url?: string | null;
};

export function buildIcs(input: IcsInput): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//IEU Labs//Student project//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${input.uid}@ieu-labs`,
    `DTSTAMP:${stampUtc(new Date())}`,
    `SUMMARY:${escapeText(input.title)}`,
  ];

  if (input.time) {
    const start = madridToUtc(input.date, input.time.slice(0, 5));
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    lines.push(`DTSTART:${stampUtc(start)}`, `DTEND:${stampUtc(end)}`);
  } else {
    const allDay = input.date.replace(/-/g, "");
    const [y, m, d] = input.date.split("-").map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10).replace(/-/g, "");
    lines.push(`DTSTART;VALUE=DATE:${allDay}`, `DTEND;VALUE=DATE:${next}`);
  }

  if (input.location) lines.push(`LOCATION:${escapeText(input.location)}`);
  if (input.url) lines.push(`URL:${escapeText(input.url)}`);
  if (input.description) lines.push(`DESCRIPTION:${escapeText(input.description)}`);

  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

/** Offer the .ics file as a download in the browser. */
export function downloadIcs(input: IcsInput) {
  const blob = new Blob([buildIcs(input)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${input.title.replace(/[^\w\-]+/g, "-").slice(0, 48) || "event"}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
