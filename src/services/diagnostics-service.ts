import { detectDirectionBias, successRate } from "../domain/diagnostics.js";
import { hasReviewDebt } from "../domain/limits.js";
import type { UiLocale } from "../domain/types.js";
import { t } from "../i18n/messages.js";
import { countDueCards } from "../repositories/cards-repository.js";
import {
  collectUserDiagnostics,
  countRecentAgains,
  getNextWeakCard,
} from "../repositories/diagnostics-repository.js";
import type { UserBundle } from "../repositories/users-repository.js";
import {
  gradeScheduledAnswer,
  presentCardFromBundle,
  type ReviewResult,
} from "./learning-service.js";

/**
 * Builds the `/report` diagnostics summary.
 */
export const buildDiagnosticsReport = async (bundle: UserBundle): Promise<string> => {
  const locale = bundle.settings.uiLocale as UiLocale;
  const due = await countDueCards(bundle.user.id);
  const { weak, leeches, direction, overall } = await collectUserDiagnostics(
    bundle.user.id,
    30,
  );
  const againStreak = await countRecentAgains(bundle.user.id, 8);
  const bias = detectDirectionBias(direction);
  const overallRate = successRate(overall);

  const lines: string[] = [
    t(locale, "reportTitle"),
    t(locale, "reportDue", { due }),
    t(locale, "reportAccuracy", {
      rate:
        overallRate === null
          ? "—"
          : `${Math.round(overallRate * 100)}% (${overall.correct}/${overall.attempts})`,
    }),
    t(locale, "reportWeakCount", { count: weak.length }),
    t(locale, "reportLeechCount", { count: leeches.length }),
  ];

  if (bias) {
    lines.push(
      t(locale, "reportDirectionBias", {
        weaker: bias.weaker === "en_to_fa" ? "EN→FA" : "FA→EN",
        stronger: bias.stronger === "en_to_fa" ? "EN→FA" : "FA→EN",
        gap: `${Math.round(bias.gap * 100)}%`,
      }),
    );
  } else {
    lines.push(t(locale, "reportDirectionOk"));
  }

  if (weak.length > 0) {
    const top = weak
      .slice(0, 8)
      .map(
        (row, index) =>
          `${index + 1}. ${row.lemma} → ${row.gloss} (${Math.round(row.successRate * 100)}%, lapses ${row.lapses})`,
      )
      .join("\n");
    lines.push(`${t(locale, "reportWeakList")}\n${top}`);
  }

  if (leeches.length > 0) {
    const top = leeches
      .slice(0, 5)
      .map((row, index) => `${index + 1}. ${row.lemma} (lapses ${row.lapses})`)
      .join("\n");
    lines.push(`${t(locale, "reportLeechList")}\n${top}`);
  }

  if (hasReviewDebt(due, bundle.settings.dailyNewLimit)) {
    lines.push(t(locale, "reportSuggestReviewDebt"));
  }
  if (bias) {
    lines.push(t(locale, "reportSuggestDirection"));
  }
  if (againStreak >= 5) {
    lines.push(t(locale, "reportSuggestCramming"));
  }
  if (weak.length > 0) {
    lines.push(t(locale, "reportSuggestWeak"));
  }

  return lines.join("\n\n");
};

/**
 * Starts a weak-word drill session (SRS grading, weak-only queue).
 */
export const startWeakDrill = async (
  bundle: UserBundle,
  options: { excludeCardIds?: string[] } = {},
): Promise<ReviewResult> => {
  const locale = bundle.settings.uiLocale as UiLocale;
  const weak = await getNextWeakCard(bundle.user.id, {
    excludeCardIds: options.excludeCardIds,
  });

  if (!weak) {
    return { kind: "empty", text: t(locale, "weakEmpty") };
  }

  const presented = await presentCardFromBundle(bundle, weak, "weak");
  return {
    ...presented,
    text: `${t(locale, "weakAhead")}\n\n${presented.text}`,
  };
};

/**
 * Grades a weak-drill answer then continues the weak queue.
 */
export const gradeWeakAnswer = async (input: {
  bundle: UserBundle;
  cardId: string;
  direction: "en_to_fa" | "fa_to_en";
  selectedIndex: number;
  correctIndex: number;
}): Promise<{ feedback: string; next: ReviewResult }> => {
  const graded = await gradeScheduledAnswer({
    ...input,
    continueMode: "review",
  });

  const next = await startWeakDrill(input.bundle, {
    excludeCardIds: [input.cardId],
  });

  return { feedback: graded.feedback, next };
};
