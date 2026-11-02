import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { z } from "zod";
import * as schema from "../db/schema.js";
import { lemmaTags, lemmas, senses, tags } from "../db/schema.js";

const seedLemmaSchema = z.object({
  sourceKey: z.string().min(1).max(120),
  lemma: z.string().min(1).max(80),
  pos: z.enum([
    "noun",
    "verb",
    "adj",
    "adv",
    "prep",
    "conj",
    "pron",
    "det",
    "phrase",
    "other",
  ]),
  cefrLevel: z.enum(["A1", "A2", "B1", "B2", "C1"]),
  phonetic: z.string().max(80).optional(),
  glossesFa: z.array(z.string().min(1).max(120)).min(1),
  exampleEn: z.string().min(1).max(240),
  exampleFa: z.string().min(1).max(240),
  tags: z.array(z.string().min(1).max(40)).default([]),
});

const seedFileSchema = z.array(seedLemmaSchema);
type SeedRow = z.infer<typeof seedLemmaSchema>;

const contentRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../content/cefr",
);

const BATCH_SIZE = 200;

/**
 * Recursively lists JSON files under the CEFR content tree.
 */
const listJsonFiles = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listJsonFiles(fullPath)));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(fullPath);
    }
  }

  return files.sort();
};

const chunk = <T>(items: T[], size: number): T[][] => {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }
  return groups;
};

/**
 * Upserts CEFR seed lemmas, senses, and tags idempotently (batched).
 */
export const loadSeeds = async (databaseUrl: string): Promise<number> => {
  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client, { schema });
  const files = await listJsonFiles(contentRoot);
  let upserted = 0;
  const tagCache = new Map<string, string>();

  const ensureTags = async (slugs: string[]): Promise<void> => {
    const missing = slugs.filter((slug) => !tagCache.has(slug));
    if (missing.length === 0) {
      return;
    }

    await db
      .insert(tags)
      .values(missing.map((slug) => ({ slug, labelEn: slug, labelFa: slug })))
      .onConflictDoNothing();

    const rows = await db.select().from(tags).where(inArray(tags.slug, missing));
    for (const row of rows) {
      tagCache.set(row.slug, row.id);
    }
  };

  for (const file of files) {
    console.log(`Seeding ${path.relative(contentRoot, file)}...`);
    const raw = JSON.parse(await readFile(file, "utf8")) as unknown;
    const rows = seedFileSchema.parse(raw);

    for (const batch of chunk(rows, BATCH_SIZE)) {
      const allTagSlugs = [...new Set(batch.flatMap((row) => row.tags))];
      await ensureTags(allTagSlugs);

      const upsertedRows: Array<{ id: string; sourceKey: string }> = [];

      for (const row of batch) {
        const [lemmaRow] = await db
          .insert(lemmas)
          .values({
            lemma: row.lemma,
            pos: row.pos,
            cefrLevel: row.cefrLevel,
            phonetic: row.phonetic,
            exampleEn: row.exampleEn,
            exampleFa: row.exampleFa,
            source: "cefr_seed",
            sourceKey: row.sourceKey,
            isActive: true,
          })
          .onConflictDoUpdate({
            target: [lemmas.source, lemmas.sourceKey],
            set: {
              lemma: row.lemma,
              pos: row.pos,
              cefrLevel: row.cefrLevel,
              phonetic: row.phonetic ?? null,
              exampleEn: row.exampleEn,
              exampleFa: row.exampleFa,
              isActive: true,
            },
          })
          .returning({ id: lemmas.id, sourceKey: lemmas.sourceKey });

        upsertedRows.push(lemmaRow!);
      }

      const lemmaIds = upsertedRows.map((row) => row.id);
      if (lemmaIds.length > 0) {
        await db.delete(senses).where(inArray(senses.lemmaId, lemmaIds));
        await db.delete(lemmaTags).where(inArray(lemmaTags.lemmaId, lemmaIds));
      }

      const senseValues = batch.flatMap((row, index) => {
        const lemmaId = upsertedRows[index]!.id;
        return row.glossesFa.map((glossFa, senseOrder) => ({
          lemmaId,
          glossFa,
          senseOrder: senseOrder + 1,
        }));
      });

      if (senseValues.length > 0) {
        await db.insert(senses).values(senseValues);
      }

      const tagValues = batch.flatMap((row, index) => {
        const lemmaId = upsertedRows[index]!.id;
        return row.tags
          .map((slug) => tagCache.get(slug))
          .filter((tagId): tagId is string => Boolean(tagId))
          .map((tagId) => ({ lemmaId, tagId }));
      });

      if (tagValues.length > 0) {
        await db.insert(lemmaTags).values(tagValues).onConflictDoNothing();
      }

      upserted += batch.length;
      console.log(`  ... ${upserted} lemmas`);
    }
  }

  await client.end({ timeout: 5 });
  return upserted;
};

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  loadSeeds(databaseUrl)
    .then((count) => {
      console.log(`Seeded/updated ${count} lemmas`);
    })
    .catch((error: unknown) => {
      console.error("Seed failed", error);
      process.exit(1);
    });
}

export type { SeedRow };
