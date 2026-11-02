import { and, asc, desc, eq, gte, ne } from "drizzle-orm";
import { db } from "../db/client.js";
import { lemmas, reviewLogs, senses, userCards } from "../db/schema.js";
import {
  isLeechCard,
  isWeakCard,
  type AttemptStats,
  type DirectionStats,
} from "../domain/diagnostics.js";
import { getGlosses, type CardWithLemma } from "./cards-repository.js";

export type WeakLemmaRow = {
  cardId: string;
  lemmaId: string;
  lemma: string;
  gloss: string;
  lapses: number;
  attempts: number;
  correct: number;
  successRate: number;
  isLeech: boolean;
};

const emptyStats = (): AttemptStats => ({ attempts: 0, correct: 0, lapses: 0 });

/**
 * Aggregates recent review-log stats and card lapses for diagnostics.
 */
export const collectUserDiagnostics = async (
  userId: string,
  windowDays = 30,
): Promise<{
  weak: WeakLemmaRow[];
  leeches: WeakLemmaRow[];
  direction: DirectionStats;
  overall: AttemptStats;
}> => {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60_000);

  const cards = await db
    .select({
      cardId: userCards.id,
      lemmaId: userCards.lemmaId,
      lemma: lemmas.lemma,
      lapses: userCards.lapses,
    })
    .from(userCards)
    .innerJoin(lemmas, eq(userCards.lemmaId, lemmas.id))
    .where(and(eq(userCards.userId, userId), ne(userCards.state, "suspended")));

  const logs = await db
    .select({
      lemmaId: reviewLogs.lemmaId,
      direction: reviewLogs.direction,
      correct: reviewLogs.correct,
      grade: reviewLogs.grade,
    })
    .from(reviewLogs)
    .where(and(eq(reviewLogs.userId, userId), gte(reviewLogs.createdAt, since)));

  const byLemma = new Map<string, AttemptStats>();
  const direction: DirectionStats = {
    enToFa: emptyStats(),
    faToEn: emptyStats(),
  };
  const overall = emptyStats();

  for (const log of logs) {
    const stats = byLemma.get(log.lemmaId) ?? emptyStats();
    stats.attempts += 1;
    if (log.correct) {
      stats.correct += 1;
    }
    if (log.grade === "again") {
      stats.lapses += 1;
    }
    byLemma.set(log.lemmaId, stats);

    overall.attempts += 1;
    if (log.correct) {
      overall.correct += 1;
    }
    if (log.grade === "again") {
      overall.lapses += 1;
    }

    if (log.direction === "en_to_fa") {
      direction.enToFa.attempts += 1;
      if (log.correct) {
        direction.enToFa.correct += 1;
      }
    } else if (log.direction === "fa_to_en") {
      direction.faToEn.attempts += 1;
      if (log.correct) {
        direction.faToEn.correct += 1;
      }
    }
  }

  const weak: WeakLemmaRow[] = [];
  const leeches: WeakLemmaRow[] = [];

  for (const card of cards) {
    const fromLogs = byLemma.get(card.lemmaId) ?? emptyStats();
    const stats: AttemptStats = {
      attempts: fromLogs.attempts,
      correct: fromLogs.correct,
      lapses: Math.max(card.lapses, fromLogs.lapses),
    };

    if (!isWeakCard(stats) && !isLeechCard(stats)) {
      continue;
    }

    const glossRows = await db
      .select({ glossFa: senses.glossFa })
      .from(senses)
      .where(eq(senses.lemmaId, card.lemmaId))
      .orderBy(asc(senses.senseOrder))
      .limit(1);

    const row: WeakLemmaRow = {
      cardId: card.cardId,
      lemmaId: card.lemmaId,
      lemma: card.lemma,
      gloss: glossRows[0]?.glossFa ?? "—",
      lapses: stats.lapses,
      attempts: stats.attempts,
      correct: stats.correct,
      successRate: stats.attempts > 0 ? stats.correct / stats.attempts : 0,
      isLeech: isLeechCard(stats),
    };

    if (row.isLeech) {
      leeches.push(row);
    }
    if (isWeakCard(stats)) {
      weak.push(row);
    }
  }

  weak.sort((a, b) => a.successRate - b.successRate || b.lapses - a.lapses);
  leeches.sort((a, b) => b.lapses - a.lapses);

  return { weak, leeches, direction, overall };
};

/**
 * Picks one weak card for review interleaving / weak drill.
 */
export const getNextWeakCard = async (
  userId: string,
  options: { excludeCardIds?: string[] } = {},
): Promise<CardWithLemma | null> => {
  const { weak } = await collectUserDiagnostics(userId, 30);
  const exclude = new Set(options.excludeCardIds ?? []);
  const candidate = weak.find((row) => !exclude.has(row.cardId));
  if (!candidate) {
    return null;
  }

  const card = await db.query.userCards.findFirst({
    where: and(eq(userCards.id, candidate.cardId), eq(userCards.userId, userId)),
  });
  if (!card || card.state === "suspended") {
    return null;
  }

  const lemma = await db.query.lemmas.findFirst({ where: eq(lemmas.id, card.lemmaId) });
  if (!lemma) {
    return null;
  }

  return { card, lemma, glosses: await getGlosses(lemma.id) };
};

/**
 * Marks a card as hard (user flag).
 */
export const markCardHard = async (userId: string, cardId: string): Promise<boolean> => {
  const updated = await db
    .update(userCards)
    .set({ isHard: true, updatedAt: new Date() })
    .where(and(eq(userCards.id, cardId), eq(userCards.userId, userId)))
    .returning({ id: userCards.id });
  return updated.length > 0;
};

/**
 * Suspends a leech card.
 */
export const suspendCard = async (userId: string, cardId: string): Promise<boolean> => {
  const updated = await db
    .update(userCards)
    .set({ state: "suspended", updatedAt: new Date() })
    .where(and(eq(userCards.id, cardId), eq(userCards.userId, userId)))
    .returning({ id: userCards.id });
  return updated.length > 0;
};

/**
 * Recent again-streak signal for cramming hint (last N logs).
 */
export const countRecentAgains = async (userId: string, limit = 8): Promise<number> => {
  const rows = await db
    .select({ grade: reviewLogs.grade })
    .from(reviewLogs)
    .where(eq(reviewLogs.userId, userId))
    .orderBy(desc(reviewLogs.createdAt))
    .limit(limit);

  let streak = 0;
  for (const row of rows) {
    if (row.grade !== "again") {
      break;
    }
    streak += 1;
  }
  return streak;
};
