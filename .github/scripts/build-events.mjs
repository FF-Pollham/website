// Fetches the Google Calendar ICS (URL from the ICS_URL env var) and writes the upcoming events as JSON.

import { writeFile } from "node:fs/promises";

const ICS_URL    = process.env.ICS_URL;
const MAX_EVENTS = 10;
const TIME_ZONE  = "Europe/Vienna";

const out = process.argv[2];
if (!out) {
  console.error("Aufruf: node build-events.mjs <ausgabedatei>");
  process.exit(2);
}
if (!ICS_URL) {
  console.error("::error::Secret ICS_URL fehlt (Settings → Secrets and variables → Actions).");
  process.exit(1);
}

const ics = await fetchIcs(ICS_URL);
const now = new Date();
const events = parseIcs(ics)
  .filter((e) => e.start >= now)
  .sort((a, b) => a.start - b.start)
  .slice(0, MAX_EVENTS)
  .map((e) => ({
    start:       e.start.toISOString(),
    end:         e.end ? e.end.toISOString() : null,
    all_day:     e.allDay,
    title:       e.summary,
    location:    e.location,
    description: e.description,
  }));

await writeFile(out, JSON.stringify({ fetched_at: now.toISOString(), events }, null, 2) + "\n");
console.log(`${events.length} Termine nach ${out} geschrieben.`);

// Exits non-zero after the last retry so the workflow skips deploying and the current site stays live.
async function fetchIcs(url) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "ff-pollham.at/1.0" },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.text();
    } catch (e) {
      lastError = e;
      console.warn(`Kalender-Abruf Versuch ${attempt} fehlgeschlagen: ${e.message}`);
      await new Promise((r) => setTimeout(r, attempt * 5000));
    }
  }
  console.error(`::error::Google Calendar konnte nicht geladen werden (${lastError.message}).`);
  process.exit(1);
}

function parseIcs(ics) {
  // Unfold continuation lines (RFC 5545).
  ics = ics.replace(/\r?\n[ \t]/g, "");

  const events = [];
  for (const [, block] of ics.matchAll(/BEGIN:VEVENT(.*?)END:VEVENT/gs)) {
    const event = { summary: "", location: "", description: "", start: null, end: null, allDay: false };

    for (let line of block.split(/\r?\n/)) {
      line = line.trim();
      const colon = line.indexOf(":");
      if (colon === -1) continue;

      const key   = line.slice(0, colon).split(";")[0].toUpperCase();
      const value = line.slice(colon + 1);

      switch (key) {
        case "SUMMARY":     event.summary = unescapeIcs(value); break;
        case "LOCATION":    event.location = unescapeIcs(value); break;
        case "DESCRIPTION": event.description = unescapeIcs(value); break;
        case "DTSTART": {
          const [dt, allDay] = parseIcalDate(value);
          event.start  = dt;
          event.allDay = allDay;
          break;
        }
        case "DTEND":
          event.end = parseIcalDate(value)[0];
          break;
      }
    }
    if (event.start) events.push(event);
  }
  return events;
}

// Times without "Z" are treated as Europe/Vienna local time.
function parseIcalDate(value) {
  const m = value.trim().match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return [null, false];
  const [, y, mo, d, h, mi, s, utc] = m;
  const allDay = h === undefined;
  const parts  = [+y, +mo - 1, +d, +(h ?? 0), +(mi ?? 0), +(s ?? 0)];
  return [utc ? new Date(Date.UTC(...parts)) : localToDate(parts, TIME_ZONE), allDay];
}

function localToDate(parts, timeZone) {
  const asUtc = Date.UTC(...parts);
  let ts = asUtc - tzOffset(asUtc, timeZone);
  ts = asUtc - tzOffset(ts, timeZone); // second pass corrects around DST changes
  return new Date(ts);
}

function tzOffset(ts, timeZone) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p = Object.fromEntries(fmt.formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(ts / 1000) * 1000;
}

function unescapeIcs(value) {
  return value.replace(/\\([\\,;nN])/g, (_, c) => (c === "n" || c === "N" ? "\n" : c));
}
