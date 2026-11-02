import { z } from "zod";

export const cefrLevelSchema = z.enum(["A1", "A2", "B1", "B2", "C1"]);
export const uiLocaleSchema = z.enum(["fa", "en"]);
export const practiceDirectionSchema = z.enum(["en_to_fa", "fa_to_en", "mixed"]);
export const srsGradeSchema = z.enum(["again", "hard", "good", "easy"]);
export const cardStateSchema = z.enum([
  "new",
  "learning",
  "review",
  "relearning",
  "suspended",
]);
export const reviewDirectionSchema = z.enum(["en_to_fa", "fa_to_en"]);

export type CefrLevel = z.infer<typeof cefrLevelSchema>;
export type UiLocale = z.infer<typeof uiLocaleSchema>;
export type PracticeDirection = z.infer<typeof practiceDirectionSchema>;
export type SrsGrade = z.infer<typeof srsGradeSchema>;
export type CardState = z.infer<typeof cardStateSchema>;
export type ReviewDirection = z.infer<typeof reviewDirectionSchema>;

export const CEFR_ORDER: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1"];
