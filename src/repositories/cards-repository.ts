import { and, asc, count, eq, inArray, lte, ne, notInArray, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { dailyUsage, lemmas, reviewLogs, senses, userCards } from "../db/schema.js";
import { createLearningCardSchedule, type SrsUpdate } from "../domain/srs.js";
import type { CefrLevel, ReviewDirection, SrsGrade } from "../domain/types.js";
import { CEFR_ORDER } from "../domain/types.js";

export type LemmaWithGlosses = {
  lemma: typeof lemmas.$inferSelect;
  glosses: string[];
};

export type CardWithLemma = {
  card: typeof userCards.$inferSelect;
  lemma: typeof lemmas.$inferSelect;
  glosses: string[];
};

/**
 * Returns daily usage counters for a user/date, creating a zero row if needed.
 */
export const getOrCreateDailyUsage = async (
  userId: string,
  usageDate: string,
): Promise<typeof dailyUsage.$inferSelect> => {
  const existing = await db.query.dailyUsage.findFirst({
    where: and(eq(dailyUsage.userId, userId), eq(dailyUsage.usageDate, usageDate)),
  });

  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(dailyUsage)
    .values({ userId, usageDate })
    .returning();

  return created!;
};

/**
 * Increments new-word introductions for the day.
 */
export const incrementNewWords = async (
  userId: string,
  usageDate: string,
  by = 1,
): Promise<void> => {
  await getOrCreateDailyUsage(userId, usageDate);
  await db
    .update(dailyUsage)
    .set({
      newWordsIntroduced: sql`${dailyUsage.newWordsIntroduced} + ${by}`,
    })
    .where(and(eq(dailyUsage.userId, userId), eq(dailyUsage.usageDate, usageDate)));
};

/**
 * Increments completed reviews for the day.
 */
export const incrementReviews = async (
  userId: string,
  usageDate: string,
  by = 1,
): Promise<void> => {
  await getOrCreateDailyUsage(userId, usageDate);
  await db
    .update(dailyUsage)
    .set({
      reviewsCompleted: sql`${dailyUsage.reviewsCompleted} + ${by}`,
    })
    .where(and(eq(dailyUsage.userId, userId), eq(dailyUsage.usageDate, usageDate)));
};

/**
 * Counts due (non-suspended) cards for a user.
 */
export const countDueCards = async (userId: string, now = new Date()): Promise<number> => {
  const [row] = await db
    .select({ value: count() })
    .from(userCards)
    .where(
      and(
        eq(userCards.userId, userId),
        ne(userCards.state, "suspended"),
        lte(userCards.dueAt, now),
      ),
    );

  return Number(row?.value ?? 0);
};

/**
 * Loads glosses for a lemma id.
 */
export const getGlosses = async (lemmaId: string): Promise<string[]> => {
  const rows = await db
    .select()
    .from(senses)
    .where(eq(senses.lemmaId, lemmaId))
    .orderBy(asc(senses.senseOrder));

  return rows.map((row) => row.glossFa);
};

/**
 * Picks the next unseen lemma at or below the user's CEFR level.
 */
export const pickNewLemma = async (
  userId: string,
  cefrLevel: CefrLevel,
): Promise<LemmaWithGlosses | null> => {
  const known = await db
    .select({ lemmaId: userCards.lemmaId })
    .from(userCards)
    .where(eq(userCards.userId, userId));

  const knownIds = known.map((row) => row.lemmaId);
  const allowedLevels = CEFR_ORDER.slice(0, CEFR_ORDER.indexOf(cefrLevel) + 1);

  const conditions = [
    eq(lemmas.isActive, true),
    inArray(lemmas.cefrLevel, allowedLevels),
  ];

  if (knownIds.length > 0) {
    conditions.push(notInArray(lemmas.id, knownIds));
  }

  const [lemma] = await db
    .select()
    .from(lemmas)
    .where(and(...conditions))
    .orderBy(asc(lemmas.cefrLevel), asc(lemmas.lemma))
    .limit(1);

  if (!lemma) {
    return null;
  }

  const glosses = await getGlosses(lemma.id);
  return { lemma, glosses };
};

/**
 * Creates a learning card for a newly introduced lemma.
 */
export const introduceLemma = async (
  userId: string,
  lemmaId: string,
): Promise<typeof userCards.$inferSelect> => {
  const schedule = createLearningCardSchedule();
  const [card] = await db
    .insert(userCards)
    .values({
      userId,
      lemmaId,
      state: schedule.state,
      stability: schedule.stability,
      difficulty: schedule.difficulty,
      learningStep: schedule.learningStep,
      dueAt: schedule.dueAt,
    })
    .returning();

  return card!;
};

const toCardWithLemma = async (
  card: typeof userCards.$inferSelect,
): Promise<CardWithLemma | null> => {
  const lemma = await db.query.lemmas.findFirst({ where: eq(lemmas.id, card.lemmaId) });
  if (!lemma) {
    return null;
  }

  const glosses = await getGlosses(lemma.id);
  return { card, lemma, glosses };
};

/**
 * Loads the next due card with lemma content.
 */
export const getNextDueCard = async (
  userId: string,
  options: { now?: Date; excludeCardIds?: string[] } = {},
): Promise<CardWithLemma | null> => {
  const now = options.now ?? new Date();
  const excludeCardIds = options.excludeCardIds ?? [];
  const conditions = [
    eq(userCards.userId, userId),
    ne(userCards.state, "suspended"),
    lte(userCards.dueAt, now),
  ];

  if (excludeCardIds.length > 0) {
    conditions.push(notInArray(userCards.id, excludeCardIds));
  }

  const [card] = await db
    .select()
    .from(userCards)
    .where(and(...conditions))
    .orderBy(
      sql`case when ${userCards.priorityUntil} is not null and ${userCards.priorityUntil} > now() then 0 else 1 end`,
      asc(userCards.dueAt),
    )
    .limit(1);

  if (!card) {
    return null;
  }

  return toCardWithLemma(card);
};

/**
 * Loads a random owned card for extra practice (ignores due dates).
 */
export const getNextPracticeCard = async (
  userId: string,
  options: { excludeCardIds?: string[] } = {},
): Promise<CardWithLemma | null> => {
  const excludeCardIds = options.excludeCardIds ?? [];
  const conditions = [
    eq(userCards.userId, userId),
    ne(userCards.state, "suspended"),
  ];

  if (excludeCardIds.length > 0) {
    conditions.push(notInArray(userCards.id, excludeCardIds));
  }

  const [card] = await db
    .select()
    .from(userCards)
    .where(and(...conditions))
    .orderBy(sql`random()`)
    .limit(1);

  if (!card) {
    return null;
  }

  return toCardWithLemma(card);
};

/**
 * Returns the soonest future dueAt for messaging, if any.
 */
export const getEarliestDueAt = async (userId: string): Promise<Date | null> => {
  const [card] = await db
    .select({ dueAt: userCards.dueAt })
    .from(userCards)
    .where(and(eq(userCards.userId, userId), ne(userCards.state, "suspended")))
    .orderBy(asc(userCards.dueAt))
    .limit(1);

  return card?.dueAt ?? null;
};

/**
 * Counts how many cards the user owns.
 */
export const countUserCards = async (userId: string): Promise<number> => {
  const [row] = await db
    .select({ value: count() })
    .from(userCards)
    .where(and(eq(userCards.userId, userId), ne(userCards.state, "suspended")));

  return Number(row?.value ?? 0);
};

/**
 * Loads a card bundle by id for the owning user.
 */
export const getCardBundle = async (
  userId: string,
  cardId: string,
): Promise<CardWithLemma | null> => {
  const card = await db.query.userCards.findFirst({
    where: and(eq(userCards.id, cardId), eq(userCards.userId, userId)),
  });

  if (!card) {
    return null;
  }

  const lemma = await db.query.lemmas.findFirst({ where: eq(lemmas.id, card.lemmaId) });
  if (!lemma) {
    return null;
  }

  return { card, lemma, glosses: await getGlosses(lemma.id) };
};

/**
 * Persists an SRS update and writes a review log.
 */
export const applyGradeToCard = async (input: {
  userId: string;
  cardId: string;
  lemmaId: string;
  direction: ReviewDirection;
  grade: SrsGrade;
  update: SrsUpdate;
  latencyMs?: number;
  mode?: string;
}): Promise<void> => {
  await db
    .update(userCards)
    .set({
      state: input.update.state,
      stability: input.update.stability,
      difficulty: input.update.difficulty,
      learningStep: input.update.learningStep,
      reps: input.update.reps,
      lapses: input.update.lapses,
      dueAt: input.update.dueAt,
      lastReviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(userCards.id, input.cardId), eq(userCards.userId, input.userId)));

  await db.insert(reviewLogs).values({
    userId: input.userId,
    userCardId: input.cardId,
    lemmaId: input.lemmaId,
    direction: input.direction,
    mode: input.mode ?? "mcq",
    grade: input.grade,
    correct: input.update.correct,
    latencyMs: input.latencyMs,
  });
};

/**
 * Logs a practice attempt without changing the SRS schedule.
 */
export const logPracticeAttempt = async (input: {
  userId: string;
  cardId: string;
  lemmaId: string;
  direction: ReviewDirection;
  correct: boolean;
}): Promise<void> => {
  await db.insert(reviewLogs).values({
    userId: input.userId,
    userCardId: input.cardId,
    lemmaId: input.lemmaId,
    direction: input.direction,
    mode: "practice",
    grade: null,
    correct: input.correct,
  });
};

/**
 * Returns random active glosses for MCQ distractors.
 */
export const sampleDistractorGlosses = async (
  excludeLemmaId: string,
  limit: number,
): Promise<string[]> => {
  const rows = await db
    .select({ glossFa: senses.glossFa })
    .from(senses)
    .innerJoin(lemmas, eq(senses.lemmaId, lemmas.id))
    .where(and(eq(lemmas.isActive, true), ne(senses.lemmaId, excludeLemmaId)))
    .orderBy(sql`random()`)
    .limit(limit);

  return rows.map((row) => row.glossFa);
};

/**
 * Returns random active English lemmas for MCQ distractors.
 */
export const sampleDistractorLemmas = async (
  excludeLemmaId: string,
  limit: number,
): Promise<string[]> => {
  const rows = await db
    .select({ lemma: lemmas.lemma })
    .from(lemmas)
    .where(and(eq(lemmas.isActive, true), ne(lemmas.id, excludeLemmaId)))
    .orderBy(sql`random()`)
    .limit(limit);

  return rows.map((row) => row.lemma);
};
