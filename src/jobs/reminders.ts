import type { Bot } from "grammy";
import { countDueCards } from "../repositories/cards-repository.js";
import { listUsersWithReminders } from "../repositories/users-repository.js";
import { t } from "../i18n/messages.js";
import type { UiLocale } from "../domain/types.js";
import { localTimeHhMm } from "../util/dates.js";
import type { BotContext } from "../bot/context.js";

/**
 * Sends due-review reminders to users whose local reminder time matches now.
 */
export const sendDueReminders = async (bot: Bot<BotContext>): Promise<void> => {
  const now = new Date();
  const users = await listUsersWithReminders();

  for (const bundle of users) {
    const reminder = bundle.settings.reminderTime;
    if (!reminder) {
      continue;
    }

    const localNow = localTimeHhMm(now, bundle.settings.timezone);
    const normalizedReminder = reminder.slice(0, 5);
    if (localNow !== normalizedReminder) {
      continue;
    }

    const due = await countDueCards(bundle.user.id, now);
    if (due <= 0) {
      continue;
    }

    const locale = bundle.settings.uiLocale as UiLocale;
    try {
      await bot.api.sendMessage(
        bundle.user.telegramId,
        t(locale, "reminder", { due }),
      );
    } catch (error) {
      console.error("Reminder failed", bundle.user.telegramId, error);
    }
  }
};
