/**
 * Builds large CEFR EN–FA seed JSON files.
 *
 * Sources (downloaded into content/raw/):
 * - CEFR-J vocabulary profile (+ Octanove C1/C2)
 * - English–Persian dictionary dataset
 * - English frequency list (to pad each level toward TARGET_PER_LEVEL)
 *
 * Usage: pnpm vocab:build
 */
import { createReadStream } from "node:fs";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const TARGET_PER_LEVEL = 10_000;
const CHUNK_SIZE = 2_000;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW = path.join(ROOT, "content/raw");
const OUT = path.join(ROOT, "content/cefr");

type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1";
type Pos =
  | "noun"
  | "verb"
  | "adj"
  | "adv"
  | "prep"
  | "conj"
  | "pron"
  | "det"
  | "phrase"
  | "other";

type SeedRow = {
  sourceKey: string;
  lemma: string;
  pos: Pos;
  cefrLevel: CefrLevel;
  glossesFa: string[];
  exampleEn: string;
  exampleFa: string;
  tags: string[];
};

const LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1"];

const POS_MAP: Record<string, Pos> = {
  noun: "noun",
  verb: "verb",
  adjective: "adj",
  adj: "adj",
  adverb: "adv",
  adv: "adv",
  preposition: "prep",
  prep: "prep",
  conjunction: "conj",
  conj: "conj",
  pronoun: "pron",
  pron: "pron",
  determiner: "det",
  det: "det",
  article: "det",
  interjection: "other",
  numeral: "other",
  modal: "verb",
  auxiliary: "verb",
};

const normalizeLemma = (raw: string): string => {
  const first = raw.split("/")[0]?.trim() ?? "";
  return first.toLowerCase().replace(/\s+/g, " ").trim();
};

const mapPos = (raw: string | undefined): Pos => {
  if (!raw) {
    return "other";
  }
  const key = raw.trim().toLowerCase();
  return POS_MAP[key] ?? "other";
};

const cleanPersian = (raw: string): string | null => {
  let value = raw.trim();
  if (!value) {
    return null;
  }
  // Drop leading Latin digits glued to Persian (dataset artifact).
  value = value.replace(/^\d+/, "").trim();
  value = value.replace(/\s+/g, " ");
  if (value.length < 1 || value.length > 80) {
    return null;
  }
  // Prefer entries that contain Persian letters.
  if (!/[\u0600-\u06FF]/.test(value)) {
    return null;
  }
  return value;
};

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

const parseCsvLine = (line: string): string[] => {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]!;
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells;
};

const readLines = async (filePath: string): Promise<string[]> => {
  const lines: string[] = [];
  const stream = createReadStream(filePath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    lines.push(line.replace(/^\uFEFF/, ""));
  }
  return lines;
};

const loadCefrLabels = async (): Promise<Map<string, { level: CefrLevel; pos: Pos }>> => {
  const map = new Map<string, { level: CefrLevel; pos: Pos }>();
  const files = [
    path.join(RAW, "cefrj-vocabulary-profile-1.5.csv"),
    path.join(RAW, "octanove-c1c2.csv"),
  ];

  for (const file of files) {
    const lines = await readLines(file);
    for (const line of lines.slice(1)) {
      if (!line.trim()) {
        continue;
      }
      const [headword, posRaw, cefrRaw] = parseCsvLine(line);
      const lemma = normalizeLemma(headword ?? "");
      const level = (cefrRaw ?? "").trim().toUpperCase() as CefrLevel;
      if (!lemma || !LEVELS.includes(level)) {
        continue;
      }
      // Prefer first POS seen for a lemma.
      if (!map.has(lemma)) {
        map.set(lemma, { level, pos: mapPos(posRaw) });
      }
    }
  }

  return map;
};

const loadFrequency = async (): Promise<string[]> => {
  const lines = await readLines(path.join(RAW, "en_50k.txt"));
  const words: string[] = [];
  for (const line of lines) {
    const lemma = normalizeLemma((line.split(/\s+/)[0] ?? "").trim());
    if (lemma && /^[a-z][a-z'-]*$/.test(lemma) && lemma.length <= 40) {
      words.push(lemma);
    }
  }
  return words;
};

/**
 * Builds lemma -> best Persian gloss map (first clean sense).
 */
const loadEnFa = async (): Promise<Map<string, string>> => {
  const map = new Map<string, string>();
  const filePath = path.join(RAW, "en-fa-dictionary.csv");
  const stream = createReadStream(filePath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let isHeader = true;

  for await (const rawLine of rl) {
    const line = rawLine.replace(/^\uFEFF/, "");
    if (isHeader) {
      isHeader = false;
      continue;
    }
    if (!line.trim()) {
      continue;
    }
    const [english, , , persian] = parseCsvLine(line);
    const lemma = normalizeLemma(english ?? "");
    if (!lemma || map.has(lemma)) {
      continue;
    }
    if (!/^[a-z][a-z' -]*$/.test(lemma) || lemma.includes("  ")) {
      continue;
    }
    const gloss = cleanPersian(persian ?? "");
    if (!gloss) {
      continue;
    }
    map.set(lemma, gloss);
  }

  return map;
};

const makeRow = (
  lemma: string,
  pos: Pos,
  level: CefrLevel,
  gloss: string,
  tag: string,
): SeedRow => {
  const sourceKey = `${level.toLowerCase()}-${slugify(lemma)}-${pos}`;
  return {
    sourceKey,
    lemma,
    pos,
    cefrLevel: level,
    glossesFa: [gloss],
    exampleEn: `Remember the word "${lemma}".`,
    exampleFa: `معنی «${lemma}»: ${gloss}`,
    tags: [tag],
  };
};

const writeLevelChunks = async (level: CefrLevel, rows: SeedRow[]): Promise<void> => {
  const dir = path.join(OUT, level.toLowerCase());
  await mkdir(dir, { recursive: true });

  // Remove old generated batches; keep hand-made sample if present by name.
  const existing = await readdir(dir);
  for (const name of existing) {
    if (name.startsWith("batch-") && name.endsWith(".json")) {
      await rm(path.join(dir, name));
    }
  }

  let chunkIndex = 1;
  for (let offset = 0; offset < rows.length; offset += CHUNK_SIZE) {
    const chunk = rows.slice(offset, offset + CHUNK_SIZE);
    const fileName = `batch-${String(chunkIndex).padStart(3, "0")}.json`;
    await writeFile(path.join(dir, fileName), `${JSON.stringify(chunk, null, 2)}\n`, "utf8");
    chunkIndex += 1;
  }
};

const frequencyBand = (rank: number): CefrLevel => {
  if (rank < 8_000) {
    return "A1";
  }
  if (rank < 16_000) {
    return "A2";
  }
  if (rank < 28_000) {
    return "B1";
  }
  if (rank < 40_000) {
    return "B2";
  }
  return "C1";
};

const run = async (): Promise<void> => {
  console.log("Loading CEFR labels...");
  const cefr = await loadCefrLabels();
  console.log(`CEFR lemmas: ${cefr.size}`);

  console.log("Loading frequency list...");
  const frequency = await loadFrequency();
  console.log(`Frequency lemmas: ${frequency.length}`);

  console.log("Loading EN–FA dictionary (this can take a minute)...");
  const enFa = await loadEnFa();
  console.log(`EN–FA glosses: ${enFa.size}`);

  const used = new Set<string>();
  const byLevel: Record<CefrLevel, SeedRow[]> = {
    A1: [],
    A2: [],
    B1: [],
    B2: [],
    C1: [],
  };

  // Pass 1: authentic CEFR-labeled words with FA gloss.
  for (const [lemma, meta] of cefr) {
    const gloss = enFa.get(lemma);
    if (!gloss || used.has(lemma)) {
      continue;
    }
    byLevel[meta.level].push(makeRow(lemma, meta.pos, meta.level, gloss, "cefr-official"));
    used.add(lemma);
  }

  console.log("After CEFR join:", LEVELS.map((level) => `${level}=${byLevel[level].length}`).join(" "));

  // Pass 2: pad each level toward TARGET using frequency bands.
  for (let rank = 0; rank < frequency.length; rank += 1) {
    const lemma = frequency[rank]!;
    if (used.has(lemma)) {
      continue;
    }
    const gloss = enFa.get(lemma);
    if (!gloss) {
      continue;
    }

    const level = frequencyBand(rank);
    if (byLevel[level].length >= TARGET_PER_LEVEL) {
      // Try to place into another under-filled level with nearby band.
      const fallback = LEVELS.find((candidate) => byLevel[candidate].length < TARGET_PER_LEVEL);
      if (!fallback) {
        break;
      }
      byLevel[fallback].push(makeRow(lemma, "other", fallback, gloss, "frequency-fill"));
      used.add(lemma);
      continue;
    }

    byLevel[level].push(makeRow(lemma, "other", level, gloss, "frequency-fill"));
    used.add(lemma);
  }

  // Pass 3: if still short, dump remaining dictionary words into underfilled levels.
  for (const [lemma, gloss] of enFa) {
    if (used.has(lemma) || !/^[a-z][a-z'-]*$/.test(lemma)) {
      continue;
    }
    const level = LEVELS.find((candidate) => byLevel[candidate].length < TARGET_PER_LEVEL);
    if (!level) {
      break;
    }
    byLevel[level].push(makeRow(lemma, "other", level, gloss, "dictionary-fill"));
    used.add(lemma);
  }

  for (const level of LEVELS) {
    const rows = byLevel[level].slice(0, TARGET_PER_LEVEL);
    byLevel[level] = rows;
    await writeLevelChunks(level, rows);
    console.log(`Wrote ${level}: ${rows.length} lemmas`);
  }

  const total = LEVELS.reduce((sum, level) => sum + byLevel[level].length, 0);
  console.log(`Done. Total lemmas: ${total}`);
};

run().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
