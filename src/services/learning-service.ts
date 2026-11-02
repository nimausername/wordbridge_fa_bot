import { applySrsGrade } from "../domain/srs.js";
import { hasReviewDebt, remainingNewWords, remainingReviews } from "../domain/limits.js";
import type {
  PracticeDirection,
  ReviewDirection,
  SrsGrade,
  UiLocale,
} from "../domain/types.js";
import { t } from "../i18n/messages.js";
import {
  applyGradeToCard,
  countDueCards,
  countUserCards,
  getCardBundle,
  getEarliestDueAt,
  getNextDueCard,
  getNextPracticeCard,
  getOrCreateDailyUsage,
  incrementNewWords,
  incrementReviews,
  introduceLemma,
  logPracticeAttempt,
  pickNewLemma,
  sampleDistractorGlosses,
  sampleDistractorLemmas,
  type CardWithLemma,
} from "../repositories/cards-repository.js";
import { getNextWeakCard } from "../repositories/diagnostics-repository.js";
import {
  touchStreak,
  type UserBundle,
} from "../repositories/users-repository.js";
import { localDateString } from "../util/dates.js";

export type HomeSummary = {
  text: string;
  due: number;
  newLeft: number;
  streak: number;
  reviewDebt: boolean;
};

export type QuizCard = {
  kind: "card";
  mode: "learn" | "review" | "practice" | "weak";
  text: string;
  cardId: string;
  options: string[];
  correctIndex: number;
  direction: ReviewDirection;
};

export type LearnResult =
  | { kind: "blocked"; text: string }
  | { kind: "empty"; text: string }
  | QuizCard;

export type ReviewResult =
  | { kind: "blocked"; text: string }
  | { kind: "empty"; text: string }
  | QuizCard;

/**
 * Builds the home screen summary for a user.
 */
export const buildHomeSummary = async (bundle: UserBundle): Promise<HomeSummary> => {
  const locale = bundle.settings.uiLocale as UiLocale;
  const due = await countDueCards(bundle.user.id);
  const usageDate = localDateString(new Date(), bundle.settings.timezone);
  const usage = await getOrCreateDailyUsage(bundle.user.id, usageDate);
  const newLeft = remainingNewWords(
    bundle.settings.dailyNewLimit,
    usage.newWordsIntroduced,
    bundle.settings.vacationMode,
  );

  return {
    text: t(locale, "home", {
      due,
      newLeft,
      streak: bundle.user.streakCount,
    }),
    due,
    newLeft,
    streak: bundle.user.streakCount,
    reviewDebt: hasReviewDebt(due, bundle.settings.dailyNewLimit),
  };
};

/**
 * Introduces one new word and quizzes it immediately (first learning step).
 */
export const startLearn = async (bundle: UserBundle): Promise<LearnResult> => {
  const locale = bundle.settings.uiLocale as UiLocale;

  if (bundle.settings.vacationMode) {
    return { kind: "blocked", text: t(locale, "vacationOn") };
  }

  const usageDate = localDateString(new Date(), bundle.settings.timezone);
  const usage = await getOrCreateDailyUsage(bundle.user.id, usageDate);
  const left = remainingNewWords(
    bundle.settings.dailyNewLimit,
    usage.newWordsIntroduced,
    false,
  );

  if (left <= 0) {
    const due = await countDueCards(bundle.user.id);
    return {
      kind: "blocked",
      text: due > 0 ? t(locale, "learnQuotaEmpty") : t(locale, "learnQuotaEmptyNoDue"),
    };
  }

  const picked = await pickNewLemma(
    bundle.user.id,
    bundle.settings.cefrLevel as never,
  );

  if (!picked) {
    return {
      kind: "empty",
      text:
        locale === "fa"
          ? "واژه جدیدی در این سطح باقی نمانده است."
          : "No more new words at this level.",
    };
  }

  const card = await introduceLemma(bundle.user.id, picked.lemma.id);
  await incrementNewWords(bundle.user.id, usageDate);
  await touchStreak(bundle.user.id, usageDate);

  const gloss = picked.glosses[0] ?? "";
  const intro = t(locale, "wordIntro", {
    lemma: picked.lemma.lemma,
    pos: picked.lemma.pos,
    gloss: picked.glosses.join("، "),
    exampleEn: picked.lemma.exampleEn,
    exampleFa: picked.lemma.exampleFa,
  });

  const direction = resolveDirection(bundle.settings.practiceDirection as PracticeDirection);
  const quiz = await buildMcq(picked.lemma.lemma, gloss, picked.lemma.id, direction);
  const ask =
    direction === "en_to_fa"
      ? t(locale, "reviewPromptEnToFa", { lemma: picked.lemma.lemma })
      : t(locale, "reviewPromptFaToEn", { gloss });

  return {
    kind: "card",
    mode: "learn",
    text: `${intro}\n\n${ask}`,
    cardId: card.id,
    options: quiz.options,
    correctIndex: quiz.correctIndex,
    direction,
  };
};

/**
 * Reviews only cards that are due now (true spaced-repetition queue).
 */
export const startReview = async (
  bundle: UserBundle,
  options: { excludeCardIds?: string[] } = {},
): Promise<ReviewResult> => {
  const locale = bundle.settings.uiLocale as UiLocale;
  const usageDate = localDateString(new Date(), bundle.settings.timezone);
  const usage = await getOrCreateDailyUsage(bundle.user.id, usageDate);
  const left = remainingReviews(bundle.settings.dailyReviewLimit, usage.reviewsCompleted);
  const excludeCardIds = options.excludeCardIds ?? [];

  if (left === 0) {
    return { kind: "blocked", text: t(locale, "reviewCapReached") };
  }

  // ~20% of reviews inject a weak card (even if not due) for remediation.
  if (Math.random() < 0.2) {
    const weak = await getNextWeakCard(bundle.user.id, { excludeCardIds });
    if (weak) {
      const presented = await presentCard(bundle, weak, "review");
      return {
        ...presented,
        text: `${t(locale, "weakInterleave")}\n\n${presented.text}`,
      };
    }
  }

  const due = await getNextDueCard(bundle.user.id, { excludeCardIds });
  if (due) {
    return presentCard(bundle, due, "review");
  }

  // If nothing due, still offer a weak card when available.
  const weakFallback = await getNextWeakCard(bundle.user.id, { excludeCardIds });
  if (weakFallback) {
    const presented = await presentCard(bundle, weakFallback, "review");
    return {
      ...presented,
      text: `${t(locale, "weakInterleave")}\n\n${presented.text}`,
    };
  }

  const owned = await countUserCards(bundle.user.id);
  if (owned === 0) {
    return { kind: "empty", text: t(locale, "noCardsYet") };
  }

  const nextDue = await getEarliestDueAt(bundle.user.id);
  const when = nextDue ? formatEta(nextDue, locale) : "—";
  return {
    kind: "empty",
    text: t(locale, "noDueReviewsEta", { when }),
  };
};

/** Recent practice cards per user so wrong answers do not repeat the same word. */
const recentPracticeCards = new Map<string, string[]>();

const rememberPracticeCard = (userId: string, cardId: string): void => {
  const previous = recentPracticeCards.get(userId) ?? [];
  recentPracticeCards.set(
    userId,
    [cardId, ...previous.filter((id) => id !== cardId)].slice(0, 8),
  );
};

const practiceExclusions = (userId: string, extra: string[] = []): string[] => [
  ...new Set([...(recentPracticeCards.get(userId) ?? []), ...extra]),
];

/**
 * Extra practice on known words. Does NOT change SRS schedules.
 * Rotates through cards — a wrong answer moves to a different word.
 */
export const startPractice = async (
  bundle: UserBundle,
  options: { excludeCardIds?: string[] } = {},
): Promise<ReviewResult> => {
  const locale = bundle.settings.uiLocale as UiLocale;
  const justAnswered = options.excludeCardIds ?? [];

  let practice = await getNextPracticeCard(bundle.user.id, {
    excludeCardIds: practiceExclusions(bundle.user.id, justAnswered),
  });

  if (!practice) {
    // Start a new round, but still skip the card that was just answered.
    recentPracticeCards.set(bundle.user.id, []);
    practice = await getNextPracticeCard(bundle.user.id, {
      excludeCardIds: justAnswered,
    });
  }

  if (!practice) {
    // Truly a one-card deck — only then repeat the same word.
    practice = await getNextPracticeCard(bundle.user.id);
  }

  if (!practice) {
    return { kind: "empty", text: t(locale, "noCardsYet") };
  }

  rememberPracticeCard(bundle.user.id, practice.card.id);

  const presented = await presentCard(bundle, practice, "practice");
  return {
    ...presented,
    text: `${t(locale, "practiceAhead")}\n\n${presented.text}`,
  };
};

/**
 * Grades a learn/review MCQ and updates the SRS schedule.
 */
export const gradeScheduledAnswer = async (input: {
  bundle: UserBundle;
  cardId: string;
  direction: ReviewDirection;
  selectedIndex: number;
  correctIndex: number;
  continueMode: "learn" | "review";
}): Promise<{ feedback: string; next: LearnResult | ReviewResult }> => {
  const locale = input.bundle.settings.uiLocale as UiLocale;
  const correct = input.selectedIndex === input.correctIndex;
  const grade: SrsGrade = correct ? "good" : "again";
  const cardBundle = await getCardBundle(input.bundle.user.id, input.cardId);

  if (!cardBundle) {
    return {
      feedback: t(locale, "unknown"),
      next: { kind: "empty", text: t(locale, "noDueReviews") },
    };
  }

  const update = applySrsGrade(
    {
      state: cardBundle.card.state as never,
      stability: cardBundle.card.stability,
      difficulty: cardBundle.card.difficulty,
      learningStep: cardBundle.card.learningStep,
      reps: cardBundle.card.reps,
      lapses: cardBundle.card.lapses,
      dueAt: cardBundle.card.dueAt,
    },
    grade,
  );

  await applyGradeToCard({
    userId: input.bundle.user.id,
    cardId: input.cardId,
    lemmaId: cardBundle.lemma.id,
    direction: input.direction,
    grade,
    update,
    mode: "mcq",
  });

  const usageDate = localDateString(new Date(), input.bundle.settings.timezone);
  await incrementReviews(input.bundle.user.id, usageDate);
  await touchStreak(input.bundle.user.id, usageDate);

  const expected =
    input.direction === "en_to_fa"
      ? cardBundle.glosses.join(" / ")
      : cardBundle.lemma.lemma;

  const feedback = correct
    ? t(locale, "correct")
    : t(locale, "incorrect", { answer: expected });

  if (input.continueMode === "learn") {
    return { feedback, next: await startLearn(input.bundle) };
  }

  // Exclude the card just answered for one turn so we rotate through the queue.
  // "Again" sets dueAt ≈ now+30s, so it returns after other due cards.
  return {
    feedback,
    next: await startReview(input.bundle, { excludeCardIds: [input.cardId] }),
  };
};

/**
 * Grades practice MCQ without touching due dates / SRS state.
 */
export const gradePracticeAnswer = async (input: {
  bundle: UserBundle;
  cardId: string;
  direction: ReviewDirection;
  selectedIndex: number;
  correctIndex: number;
}): Promise<{ feedback: string; next: ReviewResult }> => {
  const locale = input.bundle.settings.uiLocale as UiLocale;
  const correct = input.selectedIndex === input.correctIndex;
  const cardBundle = await getCardBundle(input.bundle.user.id, input.cardId);

  if (!cardBundle) {
    return {
      feedback: t(locale, "unknown"),
      next: { kind: "empty", text: t(locale, "noCardsYet") },
    };
  }

  await logPracticeAttempt({
    userId: input.bundle.user.id,
    cardId: input.cardId,
    lemmaId: cardBundle.lemma.id,
    direction: input.direction,
    correct,
  });

  // Always rotate away from this card after an answer (right or wrong).
  rememberPracticeCard(input.bundle.user.id, input.cardId);

  const expected =
    input.direction === "en_to_fa"
      ? cardBundle.glosses.join(" / ")
      : cardBundle.lemma.lemma;

  const feedback = correct
    ? t(locale, "correct")
    : t(locale, "incorrect", { answer: expected });

  return {
    feedback,
    next: await startPractice(input.bundle, { excludeCardIds: [input.cardId] }),
  };
};

/** @deprecated use gradeScheduledAnswer */
export const gradeMcqAnswer = gradeScheduledAnswer;

/**
 * Renders a lemma card as an MCQ prompt for learn/review/practice/weak.
 */
export const presentCardFromBundle = async (
  bundle: UserBundle,
  next: CardWithLemma,
  mode: "learn" | "review" | "practice" | "weak",
): Promise<QuizCard> => presentCard(bundle, next, mode);

const presentCard = async (
  bundle: UserBundle,
  next: CardWithLemma,
  mode: "learn" | "review" | "practice" | "weak",
): Promise<QuizCard> => {
  const locale = bundle.settings.uiLocale as UiLocale;
  const direction = resolveDirection(bundle.settings.practiceDirection as PracticeDirection);
  const gloss = next.glosses[0] ?? "";
  const quiz = await buildMcq(next.lemma.lemma, gloss, next.lemma.id, direction);
  const prompt =
    direction === "en_to_fa"
      ? t(locale, "reviewPromptEnToFa", { lemma: next.lemma.lemma })
      : t(locale, "reviewPromptFaToEn", { gloss });

  return {
    kind: "card",
    mode,
    text: prompt,
    cardId: next.card.id,
    options: quiz.options,
    correctIndex: quiz.correctIndex,
    direction,
  };
};

const resolveDirection = (preference: PracticeDirection): ReviewDirection => {
  if (preference === "mixed") {
    return Math.random() < 0.5 ? "en_to_fa" : "fa_to_en";
  }

  return preference;
};

const buildMcq = async (
  lemma: string,
  gloss: string,
  lemmaId: string,
  direction: ReviewDirection,
): Promise<{ prompt: string; options: string[]; correctIndex: number }> => {
  const correct = direction === "en_to_fa" ? gloss : lemma;
  const distractors =
    direction === "en_to_fa"
      ? await sampleDistractorGlosses(lemmaId, 3)
      : await sampleDistractorLemmas(lemmaId, 3);

  const unique = [correct, ...distractors.filter((item) => item !== correct)].slice(0, 4);
  while (unique.length < 4) {
    unique.push(`—${unique.length}`);
  }

  const shuffled = shuffle(unique);
  const correctIndex = shuffled.indexOf(correct);

  return {
    prompt:
      direction === "en_to_fa"
        ? "Choose the Persian meaning:"
        : "Choose the English word:",
    options: shuffled,
    correctIndex: correctIndex < 0 ? 0 : correctIndex,
  };
};

const shuffle = <T>(items: T[]): T[] => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(Math.random() * (index + 1));
    const current = copy[index]!;
    copy[index] = copy[swapWith]!;
    copy[swapWith] = current;
  }
  return copy;
};

const formatEta = (dueAt: Date, locale: UiLocale): string => {
  const deltaMs = Math.max(0, dueAt.getTime() - Date.now());
  const minutes = Math.ceil(deltaMs / 60_000);
  if (minutes <= 1) {
    return locale === "fa" ? "کمتر از ۱ دقیقه" : "under 1 minute";
  }
  if (minutes < 60) {
    return locale === "fa" ? `${minutes} دقیقه دیگر` : `in ${minutes} min`;
  }
  const hours = Math.ceil(minutes / 60);
  return locale === "fa" ? `${hours} ساعت دیگر` : `in ${hours} h`;
};
