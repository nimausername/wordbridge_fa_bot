import type { CardState, SrsGrade } from "./types.js";

const SECOND_MS = 1_000;
const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * 60_000;

/**
 * Anki-style learning delays after a successful step.
 * Index = learningStep after the successful answer.
 */
const LEARNING_STEPS_MS = [1 * MINUTE_MS, 10 * MINUTE_MS] as const;
const RELEARNING_STEPS_MS = [10 * MINUTE_MS] as const;

/** After "Again", resurface quickly inside the same study session. */
const AGAIN_DELAY_MS = 30 * SECOND_MS;

export type SrsCardSnapshot = {
  state: CardState;
  stability: number;
  difficulty: number;
  learningStep: number;
  reps: number;
  lapses: number;
  dueAt: Date;
};

export type SrsUpdate = SrsCardSnapshot & {
  correct: boolean;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const addMs = (from: Date, ms: number): Date => new Date(from.getTime() + ms);

/**
 * Applies an SM-2 / Anki-inspired grade to a user card.
 *
 * Learning flow:
 * - New cards start at step 0 and are due immediately.
 * - Good/Hard advance through short learning steps, then graduate to review.
 * - Again resets the step and makes the card due again in ~30s.
 */
export const applySrsGrade = (
  card: SrsCardSnapshot,
  grade: SrsGrade,
  now = new Date(),
): SrsUpdate => {
  if (grade === "again") {
    const stayLearning = card.state === "learning" || card.state === "new";
    return {
      state: stayLearning ? "learning" : "relearning",
      stability: Math.max(0.5, card.stability * 0.5),
      difficulty: clamp(card.difficulty + 0.4, 1, 10),
      learningStep: 0,
      reps: card.reps,
      lapses: card.lapses + 1,
      dueAt: addMs(now, AGAIN_DELAY_MS),
      correct: false,
    };
  }

  const inLearning =
    card.state === "learning" || card.state === "relearning" || card.state === "new";

  if (inLearning) {
    if (grade === "easy") {
      return graduate(card, grade, now);
    }

    const steps = card.state === "relearning" ? RELEARNING_STEPS_MS : LEARNING_STEPS_MS;
    const nextStep = card.learningStep + (grade === "hard" ? 0 : 1);

    if (nextStep >= steps.length) {
      return graduate(card, grade, now);
    }

    return {
      state: card.state === "relearning" ? "relearning" : "learning",
      stability: card.stability,
      difficulty: clamp(card.difficulty + (grade === "hard" ? 0.15 : -0.05), 1, 10),
      learningStep: nextStep,
      reps: card.reps,
      lapses: card.lapses,
      dueAt: addMs(now, steps[nextStep]!),
      correct: true,
    };
  }

  return scheduleReview(card, grade, now);
};

const graduate = (
  card: SrsCardSnapshot,
  grade: SrsGrade,
  now: Date,
): SrsUpdate => {
  const baseStability = grade === "easy" ? 3 : grade === "good" ? 1 : 0.5;
  const difficulty = clamp(
    card.difficulty + (grade === "easy" ? -0.3 : grade === "hard" ? 0.2 : 0),
    1,
    10,
  );

  return {
    state: "review",
    stability: baseStability,
    difficulty,
    learningStep: 0,
    reps: card.reps + 1,
    lapses: card.lapses,
    dueAt: addMs(now, baseStability * DAY_MS),
    correct: true,
  };
};

const scheduleReview = (
  card: SrsCardSnapshot,
  grade: SrsGrade,
  now: Date,
): SrsUpdate => {
  const gradeFactor = grade === "easy" ? 1.4 : grade === "good" ? 1.0 : 0.7;
  const difficultyPenalty = 1 - (card.difficulty - 5) * 0.05;
  const nextStability = clamp(
    Math.max(0.5, card.stability * 1.7 * gradeFactor * difficultyPenalty),
    0.5,
    365,
  );
  const nextDifficulty = clamp(
    card.difficulty + (grade === "easy" ? -0.2 : grade === "hard" ? 0.2 : 0),
    1,
    10,
  );

  return {
    state: "review",
    stability: nextStability,
    difficulty: nextDifficulty,
    learningStep: 0,
    reps: card.reps + 1,
    lapses: card.lapses,
    dueAt: addMs(now, nextStability * DAY_MS),
    correct: true,
  };
};

/**
 * Initial schedule for a newly introduced lemma.
 * Card is due immediately so the intro quiz counts as the first learning step.
 */
export const createLearningCardSchedule = (now = new Date()): SrsCardSnapshot => ({
  state: "learning",
  stability: 0,
  difficulty: 5,
  learningStep: 0,
  reps: 0,
  lapses: 0,
  dueAt: now,
});

export const AGAIN_DELAY_MS_FOR_TESTS = AGAIN_DELAY_MS;
export const LEARNING_STEPS_MS_FOR_TESTS = LEARNING_STEPS_MS;
