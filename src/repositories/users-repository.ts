import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "../db/client.js";
import { userSettings, users } from "../db/schema.js";
import type { CefrLevel, PracticeDirection, UiLocale } from "../domain/types.js";

export type TelegramIdentity = {
  telegramId: number;
  username?: string;
  firstName?: string;
};

export type UserBundle = {
  user: typeof users.$inferSelect;
  settings: typeof userSettings.$inferSelect;
};

/**
 * Upserts a Telegram user and ensures default settings exist.
 */
export const upsertTelegramUser = async (
  identity: TelegramIdentity,
): Promise<UserBundle> => {
  const existing = await db.query.users.findFirst({
    where: eq(users.telegramId, identity.telegramId),
  });

  if (existing) {
    const [user] = await db
      .update(users)
      .set({
        username: identity.username ?? existing.username,
        firstName: identity.firstName ?? existing.firstName,
        lastSeenAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id))
      .returning();

    const settings = await ensureSettings(existing.id);
    return { user: user!, settings };
  }

  const [user] = await db
    .insert(users)
    .values({
      telegramId: identity.telegramId,
      username: identity.username,
      firstName: identity.firstName,
    })
    .returning();

  const [settings] = await db
    .insert(userSettings)
    .values({ userId: user!.id })
    .returning();

  return { user: user!, settings: settings! };
};

const ensureSettings = async (
  userId: string,
): Promise<typeof userSettings.$inferSelect> => {
  const existing = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, userId),
  });

  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(userSettings)
    .values({ userId })
    .returning();

  return created!;
};

/**
 * Patches user settings and returns the updated row.
 */
export const updateUserSettings = async (
  userId: string,
  patch: Partial<{
    uiLocale: UiLocale;
    cefrLevel: CefrLevel;
    dailyNewLimit: number;
    dailyReviewLimit: number | null;
    practiceDirection: PracticeDirection;
    timezone: string;
    reminderTime: string | null;
    vacationMode: boolean;
  }>,
): Promise<typeof userSettings.$inferSelect> => {
  const [updated] = await db
    .update(userSettings)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(userSettings.userId, userId))
    .returning();

  return updated!;
};

/**
 * Marks onboarding complete for a user.
 */
export const markOnboardingComplete = async (userId: string): Promise<void> => {
  await db
    .update(users)
    .set({ onboardingCompletedAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, userId));
};

/**
 * Updates streak using the user's local study date.
 */
export const touchStreak = async (
  userId: string,
  localDate: string,
): Promise<number> => {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) {
    return 0;
  }

  if (user.lastStudyDate === localDate) {
    return user.streakCount;
  }

  const yesterday = shiftDate(localDate, -1);
  const nextStreak = user.lastStudyDate === yesterday ? user.streakCount + 1 : 1;

  await db
    .update(users)
    .set({
      streakCount: nextStreak,
      lastStudyDate: localDate,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  return nextStreak;
};

const shiftDate = (isoDate: string, days: number): string => {
  const date = new Date(`${isoDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

/**
 * Loads users who have a reminder configured.
 */
export const listUsersWithReminders = async (): Promise<UserBundle[]> => {
  const settingsRows = await db
    .select()
    .from(userSettings)
    .where(and(isNotNull(userSettings.reminderTime), eq(userSettings.vacationMode, false)));

  const bundles: UserBundle[] = [];
  for (const settings of settingsRows) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, settings.userId),
    });
    if (user?.onboardingCompletedAt) {
      bundles.push({ user, settings });
    }
  }

  return bundles;
};
