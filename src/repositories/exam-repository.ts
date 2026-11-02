import { and, asc, desc, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { examAttempts, examItems, lemmas, senses, userCards } from "../db/schema.js";
import type { ReviewDirection } from "../domain/types.js";

export type PracticedCard = {
  cardId: string;
  lemmaId: string;
  lemma: string;
  glosses: string[];
};

/**
 * Loads practiced cards (seen at least once) for exam pools.
 */
export const listPracticedCards = async (userId: string): Promise<PracticedCard[]> => {
  const cards = await db
    .select({
      cardId: userCards.id,
      lemmaId: userCards.lemmaId,
      lemma: lemmas.lemma,
    })
    .from(userCards)
    .innerJoin(lemmas, eq(userCards.lemmaId, lemmas.id))
    .where(
      and(
        eq(userCards.userId, userId),
        ne(userCards.state, "suspended"),
        isNotNull(userCards.lastReviewedAt),
        eq(lemmas.isActive, true),
      ),
    );

  const result: PracticedCard[] = [];
  for (const card of cards) {
    const glossRows = await db
      .select({ glossFa: senses.glossFa })
      .from(senses)
      .where(eq(senses.lemmaId, card.lemmaId))
      .orderBy(asc(senses.senseOrder));
    result.push({
      cardId: card.cardId,
      lemmaId: card.lemmaId,
      lemma: card.lemma,
      glosses: glossRows.map((row) => row.glossFa),
    });
  }

  return result;
};

/**
 * Creates an exam attempt and its unanswered items.
 */
export const createExamAttempt = async (input: {
  userId: string;
  mode: "quick" | "standard";
  items: Array<{
    lemmaId: string;
    direction: ReviewDirection;
    expected: string;
    orderIndex: number;
  }>;
}): Promise<{ attemptId: string }> => {
  const [attempt] = await db
    .insert(examAttempts)
    .values({
      userId: input.userId,
      mode: input.mode,
      itemCount: input.items.length,
      scoreCorrect: 0,
      scoreTotal: input.items.length,
      filtersJson: {},
    })
    .returning({ id: examAttempts.id });

  const attemptId = attempt!.id;

  if (input.items.length > 0) {
    await db.insert(examItems).values(
      input.items.map((item) => ({
        examAttemptId: attemptId,
        lemmaId: item.lemmaId,
        direction: item.direction,
        mode: "mcq",
        expected: item.expected,
        orderIndex: item.orderIndex,
      })),
    );
  }

  return { attemptId };
};

/**
 * Loads exam items for an attempt ordered by index.
 */
export const listExamItems = async (attemptId: string) =>
  db
    .select()
    .from(examItems)
    .where(eq(examItems.examAttemptId, attemptId))
    .orderBy(asc(examItems.orderIndex));

/**
 * Records an answer for one exam item.
 */
export const answerExamItem = async (input: {
  itemId: string;
  correct: boolean;
  answered: string;
}): Promise<void> => {
  await db
    .update(examItems)
    .set({
      correct: input.correct,
      answered: input.answered,
    })
    .where(eq(examItems.id, input.itemId));
};

/**
 * Finalizes attempt score and completion time.
 */
export const completeExamAttempt = async (
  attemptId: string,
  scoreCorrect: number,
): Promise<void> => {
  await db
    .update(examAttempts)
    .set({
      scoreCorrect,
      completedAt: new Date(),
    })
    .where(eq(examAttempts.id, attemptId));
};

/**
 * Boosts missed lemmas into priority review for a few days.
 */
export const prioritizeMissedLemmas = async (
  userId: string,
  lemmaIds: string[],
  days = 3,
): Promise<number> => {
  if (lemmaIds.length === 0) {
    return 0;
  }

  const until = new Date(Date.now() + days * 24 * 60 * 60_000);
  const updated = await db
    .update(userCards)
    .set({
      priorityUntil: until,
      dueAt: sql`least(${userCards.dueAt}, now())`,
      updatedAt: new Date(),
    })
    .where(and(eq(userCards.userId, userId), inArray(userCards.lemmaId, lemmaIds)))
    .returning({ id: userCards.id });

  return updated.length;
};

/**
 * Recent completed exams for history.
 */
export const listRecentExams = async (userId: string, limit = 5) =>
  db
    .select()
    .from(examAttempts)
    .where(and(eq(examAttempts.userId, userId), isNotNull(examAttempts.completedAt)))
    .orderBy(desc(examAttempts.completedAt))
    .limit(limit);
