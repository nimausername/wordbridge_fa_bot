/**
 * Remaining new-word quota for the local calendar day.
 */
export const remainingNewWords = (
  dailyNewLimit: number,
  introducedToday: number,
  vacationMode: boolean,
): number => {
  if (vacationMode) {
    return 0;
  }

  return Math.max(0, dailyNewLimit - introducedToday);
};

/**
 * Remaining review quota; null daily limit means unlimited.
 */
export const remainingReviews = (
  dailyReviewLimit: number | null,
  reviewsToday: number,
): number | null => {
  if (dailyReviewLimit === null) {
    return null;
  }

  return Math.max(0, dailyReviewLimit - reviewsToday);
};

/**
 * Detects heavy review backlog relative to the user's new-word pace.
 */
export const hasReviewDebt = (dueCount: number, dailyNewLimit: number): boolean =>
  dueCount > Math.max(20, 3 * dailyNewLimit);
