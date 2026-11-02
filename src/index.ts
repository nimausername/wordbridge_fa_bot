import cron from "node-cron";
import { createBot } from "./bot/create-bot.js";
import { closeDb } from "./db/client.js";
import { env } from "./env.js";
import { sendDueReminders } from "./jobs/reminders.js";

const bot = createBot(env.BOT_TOKEN);

cron.schedule("*/5 * * * *", () => {
  void sendDueReminders(bot).catch((error: unknown) => {
    console.error("Reminder job failed", error);
  });
});

const shutdown = async (signal: string): Promise<void> => {
  console.log(`Shutting down on ${signal}`);
  bot.stop();
  await closeDb();
  process.exit(0);
};

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});
process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});

await bot.start({
  onStart: (info) => {
    console.log(`Bot @${info.username} started (long polling)`);
  },
});
