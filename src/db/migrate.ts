import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run migrations");
}

const client = postgres(databaseUrl, { max: 1 });
const db = drizzle(client);

const run = async (): Promise<void> => {
  await migrate(db, { migrationsFolder: "drizzle" });
  console.log("Migrations applied");
  await client.end({ timeout: 5 });
};

run().catch((error: unknown) => {
  console.error("Migration failed", error);
  process.exit(1);
});
