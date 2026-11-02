/**
 * Normalizes English answers for comparison.
 */
export const normalizeEnglish = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, "")
    .replace(/\s+/g, " ");

/**
 * Normalizes Persian answers (Yeh/Kaf variants, ZW chars, punctuation).
 */
export const normalizePersian = (value: string): string =>
  value
    .trim()
    .replace(/\u200c/g, "")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ");

/**
 * Returns true when the answer matches any accepted English form.
 */
export const matchesEnglish = (answer: string, expected: string): boolean => {
  const normalizedAnswer = normalizeEnglish(answer);
  const normalizedExpected = normalizeEnglish(expected);
  if (normalizedAnswer === normalizedExpected) {
    return true;
  }

  const withoutArticle = normalizedAnswer.replace(/^(a|an|the)\s+/, "");
  return withoutArticle === normalizedExpected;
};

/**
 * Returns true when the answer matches any accepted Persian gloss.
 */
export const matchesPersian = (answer: string, glosses: string[]): boolean => {
  const normalizedAnswer = normalizePersian(answer);
  return glosses.some((gloss) => normalizePersian(gloss) === normalizedAnswer);
};
