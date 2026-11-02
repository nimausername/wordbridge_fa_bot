import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  BOT_TOKEN: z.string().min(10, "BOT_TOKEN is required (from @BotFather)"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  ADMIN_TELEGRAM_IDS: z.string().optional().default(""),
  TZ: z.string().optional().default("Asia/Tehran"),
  NODE_ENV: z.enum(["development", "test", "production"]).optional().default("development"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment:\n${details}`);
}

const adminTelegramIds = parsed.data.ADMIN_TELEGRAM_IDS.split(",")
  .map((value) => value.trim())
  .filter(Boolean)
  .map((value) => Number(value))
  .filter((value) => Number.isFinite(value));

/**
 * Validated process environment for the bot runtime.
 */
export const env = {
  ...parsed.data,
  adminTelegramIds,
};

export type Env = typeof env;
