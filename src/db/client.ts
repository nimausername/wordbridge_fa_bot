import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env.js";
import * as schema from "./schema.js";

const queryClient = postgres(env.DATABASE_URL, {
  max: 10,
});

/**
 * Shared Drizzle database client.
 */
export const db = drizzle(queryClient, { schema });

/**
 * Closes the underlying Postgres connection pool.
 */
export const closeDb = async (): Promise<void> => {
  await queryClient.end({ timeout: 5 });
};
