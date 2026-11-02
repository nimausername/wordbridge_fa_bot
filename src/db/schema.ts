import {
  boolean,
  date,
  doublePrecision,
  integer,
  bigint,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  time,
  uniqueIndex,
  uuid,
  index,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    telegramId: bigint("telegram_id", { mode: "number" }).notNull(),
    username: text("username"),
    firstName: text("first_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
    streakCount: integer("streak_count").notNull().default(0),
    lastStudyDate: date("last_study_date"),
  },
  (table) => [uniqueIndex("users_telegram_id_uidx").on(table.telegramId)],
);

export const userSettings = pgTable("user_settings", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  uiLocale: text("ui_locale").notNull().default("fa"),
  cefrLevel: text("cefr_level").notNull().default("A1"),
  dailyNewLimit: integer("daily_new_limit").notNull().default(10),
  dailyReviewLimit: integer("daily_review_limit"),
  practiceDirection: text("practice_direction").notNull().default("mixed"),
  timezone: text("timezone").notNull().default("Asia/Tehran"),
  reminderTime: time("reminder_time"),
  vacationMode: boolean("vacation_mode").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const lemmas = pgTable(
  "lemmas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    lemma: text("lemma").notNull(),
    pos: text("pos").notNull(),
    cefrLevel: text("cefr_level").notNull(),
    phonetic: text("phonetic"),
    exampleEn: text("example_en").notNull(),
    exampleFa: text("example_fa").notNull(),
    source: text("source").notNull(),
    sourceKey: text("source_key").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("lemmas_source_key_uidx").on(table.source, table.sourceKey),
    index("lemmas_cefr_active_idx").on(table.cefrLevel, table.isActive),
  ],
);

export const senses = pgTable("senses", {
  id: uuid("id").defaultRandom().primaryKey(),
  lemmaId: uuid("lemma_id")
    .notNull()
    .references(() => lemmas.id, { onDelete: "cascade" }),
  glossFa: text("gloss_fa").notNull(),
  senseOrder: integer("sense_order").notNull().default(1),
  notes: text("notes"),
});

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    labelEn: text("label_en").notNull(),
    labelFa: text("label_fa").notNull(),
  },
  (table) => [uniqueIndex("tags_slug_uidx").on(table.slug)],
);

export const lemmaTags = pgTable(
  "lemma_tags",
  {
    lemmaId: uuid("lemma_id")
      .notNull()
      .references(() => lemmas.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.lemmaId, table.tagId] })],
);

export const userCards = pgTable(
  "user_cards",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lemmaId: uuid("lemma_id")
      .notNull()
      .references(() => lemmas.id, { onDelete: "cascade" }),
    state: text("state").notNull().default("learning"),
    stability: doublePrecision("stability").notNull().default(0),
    difficulty: doublePrecision("difficulty").notNull().default(5),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    reps: integer("reps").notNull().default(0),
    lapses: integer("lapses").notNull().default(0),
    learningStep: integer("learning_step").notNull().default(0),
    isHard: boolean("is_hard").notNull().default(false),
    mnemonic: text("mnemonic"),
    priorityUntil: timestamp("priority_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("user_cards_user_lemma_uidx").on(table.userId, table.lemmaId),
    index("user_cards_due_idx").on(table.userId, table.dueAt),
  ],
);

export const reviewLogs = pgTable(
  "review_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userCardId: uuid("user_card_id")
      .notNull()
      .references(() => userCards.id, { onDelete: "cascade" }),
    lemmaId: uuid("lemma_id")
      .notNull()
      .references(() => lemmas.id, { onDelete: "cascade" }),
    direction: text("direction").notNull(),
    mode: text("mode").notNull(),
    grade: text("grade"),
    correct: boolean("correct").notNull(),
    latencyMs: integer("latency_ms"),
    prompt: text("prompt"),
    expected: text("expected"),
    answered: text("answered"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("review_logs_user_created_idx").on(table.userId, table.createdAt)],
);

export const examAttempts = pgTable("exam_attempts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  mode: text("mode").notNull(),
  itemCount: integer("item_count").notNull(),
  scoreCorrect: integer("score_correct").notNull().default(0),
  scoreTotal: integer("score_total").notNull().default(0),
  filtersJson: jsonb("filters_json").$type<Record<string, unknown>>().default({}),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const examItems = pgTable("exam_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  examAttemptId: uuid("exam_attempt_id")
    .notNull()
    .references(() => examAttempts.id, { onDelete: "cascade" }),
  lemmaId: uuid("lemma_id")
    .notNull()
    .references(() => lemmas.id, { onDelete: "cascade" }),
  direction: text("direction").notNull(),
  mode: text("mode").notNull(),
  correct: boolean("correct"),
  expected: text("expected").notNull(),
  answered: text("answered"),
  orderIndex: integer("order_index").notNull(),
});

export const dailyUsage = pgTable(
  "daily_usage",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    usageDate: date("usage_date").notNull(),
    newWordsIntroduced: integer("new_words_introduced").notNull().default(0),
    reviewsCompleted: integer("reviews_completed").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.userId, table.usageDate] })],
);

export type User = typeof users.$inferSelect;
export type UserSettings = typeof userSettings.$inferSelect;
export type Lemma = typeof lemmas.$inferSelect;
export type UserCard = typeof userCards.$inferSelect;
