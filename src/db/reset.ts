import "dotenv/config";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const tables = [
  "exam_items",
  "exam_attempts",
  "review_logs",
  "daily_usage",
  "user_cards",
  "user_settings",
  "users",
  "lemma_tags",
  "senses",
  "lemmas",
  "tags",
] as const;

const run = async (): Promise<void> => {
  const client = postgres(databaseUrl, { max: 1 });
  await client.unsafe(`TRUNCATE TABLE ${tables.map((name) => `"${name}"`).join(", ")} RESTART IDENTITY CASCADE`);
  console.log("Database reset: all app tables truncated");
  await client.end({ timeout: 5 });
};

run().catch((error: unknown) => {
  console.error("Database reset failed", error);
  process.exit(1);
});
