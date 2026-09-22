/**
 * Generate the character sets used by the subset tiers.
 *
 * The kanji grades come from davidluzgouveia/kanji-data (CC BY 4.0).
 * Grades 1-8 are the 2136 joyo kanji. Grades 9-10 are the jinmeiyo kanji.
 *
 * The generated files are committed. Later runs read them from disk, so the
 * build does not depend on the network.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data");
const SOURCE =
  "https://raw.githubusercontent.com/davidluzgouveia/kanji-data/master/kanji.json";
const CACHE = path.join(DATA, ".kanji-data.json");

/** Fetch the grade table once and keep a local copy. */
async function loadKanjiData() {
  if (existsSync(CACHE)) {
    return JSON.parse(await readFile(CACHE, "utf8"));
  }
  process.stderr.write(`fetching ${SOURCE}\n`);
  const res = await fetch(SOURCE);
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  const text = await res.text();
  await mkdir(DATA, { recursive: true });
  await writeFile(CACHE, text);
  return JSON.parse(text);
}

/** Expand an inclusive code point range into a string. */
function range(from, to) {
  let out = "";
  for (let cp = from; cp <= to; cp += 1) out += String.fromCodePoint(cp);
  return out;
}

const ASCII = range(0x20, 0x7e);

// Latin-1 letters and symbols that appear in Japanese technical documents.
const LATIN_EXTRA = " ¡¢£¤¥¦§¨©ª«¬®¯°±²³´µ¶·¸¹º»¼½¾¿×÷ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ";

const KANA = range(0x3041, 0x309f) + range(0x30a0, 0x30ff) + range(0x31f0, 0x31ff);

// CJK punctuation, fullwidth forms, and the symbols the templates rely on.
const CJK_PUNCT = range(0x3000, 0x303f);
const FULLWIDTH = range(0xff01, 0xff60) + range(0xffe0, 0xffe6);
const SYMBOLS =
  range(0x2010, 0x2027) + range(0x2030, 0x205e) + range(0x2100, 0x214f) +
  range(0x2190, 0x21ff) + range(0x2200, 0x22ff) + range(0x2460, 0x24ff) +
  range(0x2500, 0x257f) + range(0x25a0, 0x25ff) + range(0x2600, 0x26ff) +
  range(0x2700, 0x27bf) + "✅❌⚠️★☆→←↑↓";
const GREEK_CYRILLIC = range(0x0391, 0x03c9) + range(0x0410, 0x044f);

const data = await loadKanjiData();
const grades = new Map();
for (const [ch, info] of Object.entries(data)) {
  if (typeof info.grade === "number") grades.set(ch, info.grade);
}

const joyo = [...grades].filter(([, g]) => g >= 1 && g <= 8).map(([c]) => c).sort();
const jinmeiyo = [...grades].filter(([, g]) => g >= 9).map(([c]) => c).sort();

const base = ASCII + LATIN_EXTRA + KANA + CJK_PUNCT + FULLWIDTH + SYMBOLS + GREEK_CYRILLIC;
const dedupe = (s) => [...new Set([...s])].join("");

const sets = {
  "base.txt": dedupe(base),
  "joyo.txt": joyo.join(""),
  "jinmeiyo.txt": jinmeiyo.join(""),
};

await mkdir(DATA, { recursive: true });
for (const [name, chars] of Object.entries(sets)) {
  await writeFile(path.join(DATA, name), chars + "\n");
  console.log(`${name.padEnd(14)} ${[...chars].length} chars`);
}
