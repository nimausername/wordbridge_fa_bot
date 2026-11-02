import type { PracticeDirection, ReviewDirection, UiLocale } from "../domain/types.js";
import { t } from "../i18n/messages.js";
import {
  sampleDistractorGlosses,
  sampleDistractorLemmas,
} from "../repositories/cards-repository.js";
import {
  answerExamItem,
  completeExamAttempt,
  createExamAttempt,
  listExamItems,
  listPracticedCards,
  listRecentExams,
  prioritizeMissedLemmas,
  type PracticedCard,
} from "../repositories/exam-repository.js";
import type { UserBundle } from "../repositories/users-repository.js";

export type ExamMode = "quick" | "standard";

type ExamQuestion = {
  itemId: string;
  lemmaId: string;
  cardId: string;
  direction: ReviewDirection;
  prompt: string;
  options: string[];
  correctIndex: number;
  expected: string;
};

type ActiveExam = {
  attemptId: string;
  userId: string;
  mode: ExamMode;
  questions: ExamQuestion[];
  index: number;
  scoreCorrect: number;
  missedLemmaIds: string[];
};

const activeExams = new Map<string, ActiveExam>();

const modeSize: Record<ExamMode, number> = {
  quick: 10,
  standard: 20,
};

/**
 * Clears any in-progress exam session for a user.
 */
export const clearActiveExam = (userId: string): void => {
  activeExams.delete(userId);
};

/**
 * Starts an exam from practiced vocabulary only.
 */
export const startExam = async (
  bundle: UserBundle,
  mode: ExamMode,
): Promise<
  | { kind: "blocked"; text: string }
  | { kind: "question"; text: string; options: string[]; correctIndex: number }
> => {
  const locale = bundle.settings.uiLocale as UiLocale;
  const practiced = await listPracticedCards(bundle.user.id);
  const wanted = modeSize[mode];

  if (practiced.length === 0) {
    return { kind: "blocked", text: t(locale, "examNoWords") };
  }

  if (practiced.length < Math.min(5, wanted)) {
    return {
      kind: "blocked",
      text: t(locale, "examTooFew", { have: practiced.length, need: Math.min(5, wanted) }),
    };
  }

  const pool = shuffle(practiced).slice(0, Math.min(wanted, practiced.length));
  const directionPref = bundle.settings.practiceDirection as PracticeDirection;

  const prepared: Array<{
    card: PracticedCard;
    direction: ReviewDirection;
    expected: string;
    prompt: string;
    options: string[];
    correctIndex: number;
  }> = [];

  for (const card of pool) {
    const direction = resolveDirection(directionPref);
    const gloss = card.glosses[0] ?? "";
    const expected = direction === "en_to_fa" ? gloss : card.lemma;
    const quiz = await buildMcq(card.lemma, gloss, card.lemmaId, direction);
    const prompt =
      direction === "en_to_fa"
        ? t(locale, "reviewPromptEnToFa", { lemma: card.lemma })
        : t(locale, "reviewPromptFaToEn", { gloss });

    prepared.push({
      card,
      direction,
      expected,
      prompt,
      options: quiz.options,
      correctIndex: quiz.correctIndex,
    });
  }

  const { attemptId } = await createExamAttempt({
    userId: bundle.user.id,
    mode,
    items: prepared.map((item, orderIndex) => ({
      lemmaId: item.card.lemmaId,
      direction: item.direction,
      expected: item.expected,
      orderIndex,
    })),
  });

  const dbItems = await listExamItems(attemptId);
  const questions: ExamQuestion[] = prepared.map((item, index) => ({
    itemId: dbItems[index]!.id,
    lemmaId: item.card.lemmaId,
    cardId: item.card.cardId,
    direction: item.direction,
    prompt: item.prompt,
    options: item.options,
    correctIndex: item.correctIndex,
    expected: item.expected,
  }));

  activeExams.set(bundle.user.id, {
    attemptId,
    userId: bundle.user.id,
    mode,
    questions,
    index: 0,
    scoreCorrect: 0,
    missedLemmaIds: [],
  });

  return presentCurrentQuestion(bundle.user.id, locale);
};

/**
 * Grades the current exam question and advances.
 */
export const gradeExamAnswer = async (input: {
  bundle: UserBundle;
  selectedIndex: number;
  correctIndex: number;
}): Promise<
  | { kind: "question"; feedback: string; text: string; options: string[]; correctIndex: number }
  | {
      kind: "finished";
      feedback: string;
      text: string;
      attemptId: string;
      missedCount: number;
    }
  | { kind: "blocked"; text: string }
> => {
  const locale = input.bundle.settings.uiLocale as UiLocale;
  const exam = activeExams.get(input.bundle.user.id);
  if (!exam) {
    return { kind: "blocked", text: t(locale, "examNotActive") };
  }

  const current = exam.questions[exam.index];
  if (!current) {
    return { kind: "blocked", text: t(locale, "examNotActive") };
  }

  const correct = input.selectedIndex === input.correctIndex;
  const answered = current.options[input.selectedIndex] ?? "";

  await answerExamItem({
    itemId: current.itemId,
    correct,
    answered,
  });

  if (correct) {
    exam.scoreCorrect += 1;
  } else {
    exam.missedLemmaIds.push(current.lemmaId);
  }

  const feedback = correct
    ? t(locale, "correct")
    : t(locale, "incorrect", { answer: current.expected });

  exam.index += 1;

  if (exam.index >= exam.questions.length) {
    await completeExamAttempt(exam.attemptId, exam.scoreCorrect);
    const summary = t(locale, "examFinished", {
      correct: exam.scoreCorrect,
      total: exam.questions.length,
      missed: exam.missedLemmaIds.length,
    });
    const attemptId = exam.attemptId;
    const missedCount = exam.missedLemmaIds.length;
    // Keep missed ids until prioritize callback, then clear.
    activeExams.set(input.bundle.user.id, { ...exam, questions: [] });
    return {
      kind: "finished",
      feedback,
      text: summary,
      attemptId,
      missedCount,
    };
  }

  activeExams.set(input.bundle.user.id, exam);
  const next = presentCurrentQuestion(input.bundle.user.id, locale);
  if (next.kind !== "question") {
    return next;
  }

  return {
    kind: "question",
    feedback,
    text: next.text,
    options: next.options,
    correctIndex: next.correctIndex,
  };
};

/**
 * Adds missed exam lemmas to priority review and clears the session.
 */
export const prioritizeExamMisses = async (
  bundle: UserBundle,
): Promise<{ text: string }> => {
  const locale = bundle.settings.uiLocale as UiLocale;
  const exam = activeExams.get(bundle.user.id);
  const missed = exam?.missedLemmaIds ?? [];
  const count = await prioritizeMissedLemmas(bundle.user.id, missed);
  clearActiveExam(bundle.user.id);
  return { text: t(locale, "examPrioritized", { count }) };
};

/**
 * Dismisses miss prioritization and clears session.
 */
export const dismissExamMisses = (bundle: UserBundle): { text: string } => {
  const locale = bundle.settings.uiLocale as UiLocale;
  clearActiveExam(bundle.user.id);
  return { text: t(locale, "examMissesSkipped") };
};

/**
 * Builds a short exam history message.
 */
export const buildExamHistory = async (bundle: UserBundle): Promise<string> => {
  const locale = bundle.settings.uiLocale as UiLocale;
  const rows = await listRecentExams(bundle.user.id, 5);
  if (rows.length === 0) {
    return t(locale, "examHistoryEmpty");
  }

  const lines = rows.map((row, index) => {
    const when = row.completedAt?.toISOString().slice(0, 10) ?? "—";
    return `${index + 1}. ${row.mode} — ${row.scoreCorrect}/${row.scoreTotal} (${when})`;
  });

  return `${t(locale, "examHistoryTitle")}\n${lines.join("\n")}`;
};

const presentCurrentQuestion = (
  userId: string,
  locale: UiLocale,
):
  | { kind: "blocked"; text: string }
  | { kind: "question"; text: string; options: string[]; correctIndex: number } => {
  const exam = activeExams.get(userId);
  const current = exam?.questions[exam.index];
  if (!exam || !current) {
    return { kind: "blocked", text: t(locale, "examNotActive") };
  }

  const progress = t(locale, "examProgress", {
    current: exam.index + 1,
    total: exam.questions.length,
  });

  return {
    kind: "question",
    text: `${progress}\n\n${current.prompt}`,
    options: current.options,
    correctIndex: current.correctIndex,
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
): Promise<{ options: string[]; correctIndex: number }> => {
  const correct = direction === "en_to_fa" ? gloss : lemma;
  const distractors =
    direction === "en_to_fa"
      ? await sampleDistractorGlosses(lemmaId, 3)
      : await sampleDistractorLemmas(lemmaId, 3);

  const unique = [correct, ...distractors.filter((item) => item !== correct)].slice(0, 4);
  while (unique.length < 4) {
    unique.push(`—${unique.length}`);
  }

  const options = shuffle(unique);
  const correctIndex = options.indexOf(correct);
  return { options, correctIndex: correctIndex < 0 ? 0 : correctIndex };
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
