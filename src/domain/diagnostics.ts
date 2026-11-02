export const WEAK_MIN_ATTEMPTS = 3;
export const WEAK_MAX_SUCCESS_RATE = 0.6;
export const WEAK_MIN_LAPSES = 3;
export const LEECH_MIN_LAPSES = 6;
export const DIRECTION_MIN_ATTEMPTS = 5;
export const DIRECTION_BIAS_GAP = 0.2;

export type AttemptStats = {
  attempts: number;
  correct: number;
  lapses: number;
};

export type DirectionStats = {
  enToFa: AttemptStats;
  faToEn: AttemptStats;
};

/**
 * True when a card is considered weak for drills and report lists.
 */
export const isWeakCard = (stats: AttemptStats): boolean => {
  if (stats.lapses >= WEAK_MIN_LAPSES) {
    return true;
  }
  if (stats.attempts < WEAK_MIN_ATTEMPTS) {
    return false;
  }
  return stats.correct / stats.attempts < WEAK_MAX_SUCCESS_RATE;
};

/**
 * True when a card is a leech (too many lapses).
 */
export const isLeechCard = (stats: AttemptStats): boolean =>
  stats.lapses >= LEECH_MIN_LAPSES;

/**
 * Success rate helper; returns null when there is not enough data.
 */
export const successRate = (stats: AttemptStats): number | null => {
  if (stats.attempts <= 0) {
    return null;
  }
  return stats.correct / stats.attempts;
};

export type DirectionBias = {
  weaker: "en_to_fa" | "fa_to_en";
  stronger: "en_to_fa" | "fa_to_en";
  gap: number;
  enToFaRate: number;
  faToEnRate: number;
};

/**
 * Detects a meaningful accuracy gap between practice directions.
 */
export const detectDirectionBias = (stats: DirectionStats): DirectionBias | null => {
  if (
    stats.enToFa.attempts < DIRECTION_MIN_ATTEMPTS ||
    stats.faToEn.attempts < DIRECTION_MIN_ATTEMPTS
  ) {
    return null;
  }

  const enToFaRate = stats.enToFa.correct / stats.enToFa.attempts;
  const faToEnRate = stats.faToEn.correct / stats.faToEn.attempts;
  const gap = Math.abs(enToFaRate - faToEnRate);

  if (gap < DIRECTION_BIAS_GAP) {
    return null;
  }

  const weaker = enToFaRate < faToEnRate ? "en_to_fa" : "fa_to_en";
  const stronger = weaker === "en_to_fa" ? "fa_to_en" : "en_to_fa";

  return {
    weaker,
    stronger,
    gap,
    enToFaRate,
    faToEnRate,
  };
};
