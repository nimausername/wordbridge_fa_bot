CREATE TABLE "daily_usage" (
	"user_id" uuid NOT NULL,
	"usage_date" date NOT NULL,
	"new_words_introduced" integer DEFAULT 0 NOT NULL,
	"reviews_completed" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "daily_usage_user_id_usage_date_pk" PRIMARY KEY("user_id","usage_date")
);
--> statement-breakpoint
CREATE TABLE "exam_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"mode" text NOT NULL,
	"item_count" integer NOT NULL,
	"score_correct" integer DEFAULT 0 NOT NULL,
	"score_total" integer DEFAULT 0 NOT NULL,
	"filters_json" jsonb DEFAULT '{}'::jsonb,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_attempt_id" uuid NOT NULL,
	"lemma_id" uuid NOT NULL,
	"direction" text NOT NULL,
	"mode" text NOT NULL,
	"correct" boolean,
	"expected" text NOT NULL,
	"answered" text,
	"order_index" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lemma_tags" (
	"lemma_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "lemma_tags_lemma_id_tag_id_pk" PRIMARY KEY("lemma_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "lemmas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lemma" text NOT NULL,
	"pos" text NOT NULL,
	"cefr_level" text NOT NULL,
	"phonetic" text,
	"example_en" text NOT NULL,
	"example_fa" text NOT NULL,
	"source" text NOT NULL,
	"source_key" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"user_card_id" uuid NOT NULL,
	"lemma_id" uuid NOT NULL,
	"direction" text NOT NULL,
	"mode" text NOT NULL,
	"grade" text,
	"correct" boolean NOT NULL,
	"latency_ms" integer,
	"prompt" text,
	"expected" text,
	"answered" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "senses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lemma_id" uuid NOT NULL,
	"gloss_fa" text NOT NULL,
	"sense_order" integer DEFAULT 1 NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"label_en" text NOT NULL,
	"label_fa" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"lemma_id" uuid NOT NULL,
	"state" text DEFAULT 'learning' NOT NULL,
	"stability" double precision DEFAULT 0 NOT NULL,
	"difficulty" double precision DEFAULT 5 NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"last_reviewed_at" timestamp with time zone,
	"reps" integer DEFAULT 0 NOT NULL,
	"lapses" integer DEFAULT 0 NOT NULL,
	"learning_step" integer DEFAULT 0 NOT NULL,
	"is_hard" boolean DEFAULT false NOT NULL,
	"mnemonic" text,
	"priority_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"ui_locale" text DEFAULT 'fa' NOT NULL,
	"cefr_level" text DEFAULT 'A1' NOT NULL,
	"daily_new_limit" integer DEFAULT 10 NOT NULL,
	"daily_review_limit" integer,
	"practice_direction" text DEFAULT 'mixed' NOT NULL,
	"timezone" text DEFAULT 'Asia/Tehran' NOT NULL,
	"reminder_time" time,
	"vacation_mode" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"telegram_id" bigint NOT NULL,
	"username" text,
	"first_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"onboarding_completed_at" timestamp with time zone,
	"streak_count" integer DEFAULT 0 NOT NULL,
	"last_study_date" date
);
--> statement-breakpoint
ALTER TABLE "daily_usage" ADD CONSTRAINT "daily_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_items" ADD CONSTRAINT "exam_items_exam_attempt_id_exam_attempts_id_fk" FOREIGN KEY ("exam_attempt_id") REFERENCES "public"."exam_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_items" ADD CONSTRAINT "exam_items_lemma_id_lemmas_id_fk" FOREIGN KEY ("lemma_id") REFERENCES "public"."lemmas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lemma_tags" ADD CONSTRAINT "lemma_tags_lemma_id_lemmas_id_fk" FOREIGN KEY ("lemma_id") REFERENCES "public"."lemmas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lemma_tags" ADD CONSTRAINT "lemma_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_logs" ADD CONSTRAINT "review_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_logs" ADD CONSTRAINT "review_logs_user_card_id_user_cards_id_fk" FOREIGN KEY ("user_card_id") REFERENCES "public"."user_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_logs" ADD CONSTRAINT "review_logs_lemma_id_lemmas_id_fk" FOREIGN KEY ("lemma_id") REFERENCES "public"."lemmas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "senses" ADD CONSTRAINT "senses_lemma_id_lemmas_id_fk" FOREIGN KEY ("lemma_id") REFERENCES "public"."lemmas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_cards" ADD CONSTRAINT "user_cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_cards" ADD CONSTRAINT "user_cards_lemma_id_lemmas_id_fk" FOREIGN KEY ("lemma_id") REFERENCES "public"."lemmas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lemmas_source_key_uidx" ON "lemmas" USING btree ("source","source_key");--> statement-breakpoint
CREATE INDEX "lemmas_cefr_active_idx" ON "lemmas" USING btree ("cefr_level","is_active");--> statement-breakpoint
CREATE INDEX "review_logs_user_created_idx" ON "review_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_slug_uidx" ON "tags" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "user_cards_user_lemma_uidx" ON "user_cards" USING btree ("user_id","lemma_id");--> statement-breakpoint
CREATE INDEX "user_cards_due_idx" ON "user_cards" USING btree ("user_id","due_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_telegram_id_uidx" ON "users" USING btree ("telegram_id");