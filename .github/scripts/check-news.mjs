// Validates data/news.json before deploying. Error messages are German because editors read them.

import { readFile } from "node:fs/promises";

const TAGS = ["event", "news", "mission"];

const file = process.argv[2];
if (!file) {
  console.error("Aufruf: node check-news.mjs <datei>");
  process.exit(2);
}

const text   = await readFile(file, "utf8");
const errors = [];

let data;
try {
  data = JSON.parse(text);
} catch (e) {
  const pos  = Number((e.message.match(/position (\d+)/) || [])[1]);
  const line = Number.isFinite(pos) ? text.slice(0, pos).split("\n").length : undefined;
  fail([{
    line,
    msg: "Die Datei ist kein gültiges JSON" + (line ? ` (Problem in oder kurz vor Zeile ${line})` : "") + ". " +
         "Häufige Ursachen: fehlendes Komma zwischen zwei Einträgen, Komma nach dem letzten Eintrag, " +
         "fehlendes Anführungszeichen. Technische Meldung: " + e.message,
  }]);
}

const items = data && data.items;
if (!Array.isArray(items)) {
  fail([{ msg: 'Die Datei muss die Form { "items": [ ... ] } haben.' }]);
}

items.forEach((it, i) => {
  const label = `Eintrag ${i + 1}` + (it && typeof it.title === "string" && it.title ? ` („${it.title}“)` : "");
  if (!it || typeof it !== "object" || Array.isArray(it)) {
    errors.push({ msg: `${label}: muss ein Objekt in geschweiften Klammern { ... } sein.` });
    return;
  }
  if (!TAGS.includes(it.tag)) {
    errors.push({ msg: `${label}: "tag" muss "event", "news" oder "mission" sein (ist: ${JSON.stringify(it.tag)}).` });
  }
  if (typeof it.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(it.date) || isNaN(new Date(it.date + "T00:00:00Z"))
      || new Date(it.date + "T00:00:00Z").toISOString().slice(0, 10) !== it.date) {
    errors.push({ msg: `${label}: "date" muss ein gültiges Datum im Format JJJJ-MM-TT sein, z. B. "2026-06-15" (ist: ${JSON.stringify(it.date)}).` });
  }
  if (typeof it.title !== "string" || it.title.trim() === "") {
    errors.push({ msg: `${label}: "title" fehlt oder ist leer.` });
  }
  if (it.excerpt !== undefined && typeof it.excerpt !== "string") {
    errors.push({ msg: `${label}: "excerpt" muss ein Text in Anführungszeichen sein.` });
  }
  const unknown = Object.keys(it).filter((k) => !["tag", "date", "title", "excerpt"].includes(k));
  if (unknown.length) {
    errors.push({ msg: `${label}: unbekannte Felder ${unknown.map((k) => `"${k}"`).join(", ")} (Tippfehler?).` });
  }
});

if (errors.length) fail(errors);
console.log(`${file}: ${items.length} Beiträge, alles in Ordnung.`);

function fail(list) {
  for (const { line, msg } of list) {
    console.log(`::error file=${file}${line ? `,line=${line}` : ""}::${msg}`);
  }
  process.exit(1);
}
