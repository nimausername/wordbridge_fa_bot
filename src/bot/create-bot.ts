import { Bot } from "grammy";
import type { CefrLevel, PracticeDirection, UiLocale } from "../domain/types.js";
import { t } from "../i18n/messages.js";
import {
  countDueCards,
  getOrCreateDailyUsage,
} from "../repositories/cards-repository.js";
import {
  markOnboardingComplete,
  updateUserSettings,
  upsertTelegramUser,
} from "../repositories/users-repository.js";
import {
  buildDiagnosticsReport,
  gradeWeakAnswer,
  startWeakDrill,
} from "../services/diagnostics-service.js";
import {
  buildExamHistory,
  dismissExamMisses,
  gradeExamAnswer,
  prioritizeExamMisses,
  startExam,
  type ExamMode,
} from "../services/exam-service.js";
import {
  buildHomeSummary,
  gradePracticeAnswer,
  gradeScheduledAnswer,
  startLearn,
  startPractice,
  startReview,
  type LearnResult,
  type ReviewResult,
} from "../services/learning-service.js";
import { localDateString } from "../util/dates.js";
import type { BotContext } from "./context.js";
import {
  dailyLimitKeyboard,
  directionKeyboard,
  examMcqKeyboard,
  examMissKeyboard,
  examModeKeyboard,
  homeKeyboard,
  levelKeyboard,
  localeKeyboard,
  mcqKeyboard,
  settingsKeyboard,
} from "./keyboards.js";

/**
 * Creates and wires the grammY bot instance.
 */
export const createBot = (token: string): Bot<BotContext> => {
  const bot = new Bot<BotContext>(token);

  bot.use(async (ctx, next) => {
    const from = ctx.from;
    if (!from) {
      return;
    }

    ctx.bundle = await upsertTelegramUser({
      telegramId: from.id,
      username: from.username,
      firstName: from.first_name,
    });

    await next();
  });

  bot.catch((error) => {
    console.error("Bot error", error.error);
  });

  bot.command("start", async (ctx) => {
    const bundle = ctx.bundle!;
    if (!bundle.user.onboardingCompletedAt) {
      await ctx.reply(t("fa", "chooseLocale"), { reply_markup: localeKeyboard() });
      return;
    }

    const home = await buildHomeSummary(bundle);
    await ctx.reply(home.text, {
      reply_markup: homeKeyboard(bundle.settings.uiLocale as UiLocale),
    });
  });

  bot.command("help", async (ctx) => {
    const locale = (ctx.bundle?.settings.uiLocale ?? "fa") as UiLocale;
    await ctx.reply(t(locale, "help"), {
      reply_markup: homeKeyboard(locale),
    });
  });

  bot.command("learn", async (ctx) => {
    await handleLearn(ctx);
  });

  bot.command("review", async (ctx) => {
    await handleReview(ctx);
  });

  bot.command("practice", async (ctx) => {
    await handlePractice(ctx);
  });

  bot.command("exam", async (ctx) => {
    await handleExamMenu(ctx);
  });

  bot.command("exams", async (ctx) => {
    if (!(await ensureOnboarded(ctx))) {
      return;
    }
    await ctx.reply(await buildExamHistory(ctx.bundle!));
  });

  bot.command("stats", async (ctx) => {
    await handleStats(ctx);
  });

  bot.command("report", async (ctx) => {
    await handleReport(ctx);
  });

  bot.command("weak", async (ctx) => {
    await handleWeak(ctx);
  });

  bot.command("settings", async (ctx) => {
    await handleSettings(ctx);
  });

  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text.trim();
    const locale = (ctx.bundle?.settings.uiLocale ?? "fa") as UiLocale;

    if (isAction(text, ["یادگیری", "Learn"])) {
      await handleLearn(ctx);
      return;
    }
    if (isAction(text, ["مرور", "Review"])) {
      await handleReview(ctx);
      return;
    }
    if (isAction(text, ["آزمون", "Exam"])) {
      await handleExamMenu(ctx);
      return;
    }
    if (isAction(text, ["تمرین", "Practice"])) {
      await handlePractice(ctx);
      return;
    }
    if (isAction(text, ["ضعیف", "Weak"])) {
      await handleWeak(ctx);
      return;
    }
    if (isAction(text, ["گزارش", "Report"])) {
      await handleReport(ctx);
      return;
    }
    if (isAction(text, ["آمار", "Stats"])) {
      await handleStats(ctx);
      return;
    }
    if (isAction(text, ["تنظیمات", "Settings"])) {
      await handleSettings(ctx);
      return;
    }
    if (isAction(text, ["راهنما", "Help"])) {
      await ctx.reply(t(locale, "help"));
      return;
    }

    if (!ctx.bundle?.user.onboardingCompletedAt) {
      await ctx.reply(t("fa", "chooseLocale"), { reply_markup: localeKeyboard() });
      return;
    }

    await ctx.reply(t(locale, "unknown"));
  });

  bot.callbackQuery(/^onboard:locale:(fa|en)$/, async (ctx) => {
    const locale = ctx.match[1] as UiLocale;
    await updateUserSettings(ctx.bundle!.user.id, { uiLocale: locale });
    ctx.bundle!.settings.uiLocale = locale;
    await ctx.answerCallbackQuery();

    if (ctx.bundle!.user.onboardingCompletedAt) {
      await ctx.reply(t(locale, "onboardingDone"), { reply_markup: homeKeyboard(locale) });
      return;
    }

    await ctx.editMessageText(t(locale, "chooseLevel"), { reply_markup: levelKeyboard() });
  });

  bot.callbackQuery(/^onboard:level:(A1|A2|B1|B2|C1)$/, async (ctx) => {
    const level = ctx.match[1] as CefrLevel;
    const locale = ctx.bundle!.settings.uiLocale as UiLocale;
    await updateUserSettings(ctx.bundle!.user.id, { cefrLevel: level });
    ctx.bundle!.settings.cefrLevel = level;
    await ctx.answerCallbackQuery();

    if (ctx.bundle!.user.onboardingCompletedAt) {
      await ctx.reply(`CEFR: ${level}`, { reply_markup: homeKeyboard(locale) });
      return;
    }

    await ctx.editMessageText(t(locale, "chooseDailyLimit"), {
      reply_markup: dailyLimitKeyboard(),
    });
  });

  bot.callbackQuery(/^onboard:limit:(\d+)$/, async (ctx) => {
    const limit = Number(ctx.match[1]);
    const locale = ctx.bundle!.settings.uiLocale as UiLocale;
    await updateUserSettings(ctx.bundle!.user.id, { dailyNewLimit: limit });
    ctx.bundle!.settings.dailyNewLimit = limit;
    await ctx.answerCallbackQuery();

    if (ctx.bundle!.user.onboardingCompletedAt) {
      await ctx.reply(`Limit: ${limit}`, { reply_markup: homeKeyboard(locale) });
      return;
    }

    await ctx.editMessageText(t(locale, "chooseDirection"), {
      reply_markup: directionKeyboard(),
    });
  });

  bot.callbackQuery(/^onboard:dir:(en_to_fa|fa_to_en|mixed)$/, async (ctx) => {
    const direction = ctx.match[1] as PracticeDirection;
    const locale = ctx.bundle!.settings.uiLocale as UiLocale;
    await updateUserSettings(ctx.bundle!.user.id, {
      practiceDirection: direction,
      reminderTime: ctx.bundle!.settings.reminderTime ?? "20:00:00",
    });
    ctx.bundle!.settings.practiceDirection = direction;
    await ctx.answerCallbackQuery();

    if (!ctx.bundle!.user.onboardingCompletedAt) {
      await markOnboardingComplete(ctx.bundle!.user.id);
      ctx.bundle!.user.onboardingCompletedAt = new Date();
      await ctx.editMessageText(t(locale, "onboardingDone"));
      const home = await buildHomeSummary(ctx.bundle!);
      await ctx.reply(home.text, { reply_markup: homeKeyboard(locale) });
      return;
    }

    await ctx.reply(`Direction: ${direction}`, { reply_markup: homeKeyboard(locale) });
  });

  bot.callbackQuery(
    /^(learn|review|practice|weak):ans:([^:]+):([^:]+):(\d+):(\d+)$/,
    async (ctx) => {
      const kind = ctx.match[1] as "learn" | "review" | "practice" | "weak";
      const cardId = ctx.match[2]!;
      const direction = ctx.match[3] as "en_to_fa" | "fa_to_en";
      const correctIndex = Number(ctx.match[4]);
      const selectedIndex = Number(ctx.match[5]);

      await ctx.answerCallbackQuery();

      const previous = ctx.callbackQuery.message?.text ?? "";

      if (kind === "practice") {
        const { feedback, next } = await gradePracticeAnswer({
          bundle: ctx.bundle!,
          cardId,
          direction,
          selectedIndex,
          correctIndex,
        });
        await ctx.editMessageText(`${previous}\n\n${feedback}`);
        await replyQuizResult(ctx, next);
        return;
      }

      if (kind === "weak") {
        const { feedback, next } = await gradeWeakAnswer({
          bundle: ctx.bundle!,
          cardId,
          direction,
          selectedIndex,
          correctIndex,
        });
        await ctx.editMessageText(`${previous}\n\n${feedback}`);
        await replyQuizResult(ctx, next);
        return;
      }

      const { feedback, next } = await gradeScheduledAnswer({
        bundle: ctx.bundle!,
        cardId,
        direction,
        selectedIndex,
        correctIndex,
        continueMode: kind,
      });

      await ctx.editMessageText(`${previous}\n\n${feedback}`);
      await replyQuizResult(ctx, next);
    },
  );

  bot.callbackQuery(/^exam:mode:(quick|standard)$/, async (ctx) => {
    const mode = ctx.match[1] as ExamMode;
    await ctx.answerCallbackQuery();
    if (!(await ensureOnboarded(ctx))) {
      return;
    }

    const result = await startExam(ctx.bundle!, mode);
    if (result.kind === "blocked") {
      await ctx.editMessageText(result.text);
      return;
    }

    await ctx.editMessageText(result.text, {
      reply_markup: examMcqKeyboard(result.options, result.correctIndex),
    });
  });

  bot.callbackQuery("exam:history", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(await buildExamHistory(ctx.bundle!));
  });

  bot.callbackQuery(/^exam:ans:(\d+):(\d+)$/, async (ctx) => {
    const correctIndex = Number(ctx.match[1]);
    const selectedIndex = Number(ctx.match[2]);
    await ctx.answerCallbackQuery();

    const previous = ctx.callbackQuery.message?.text ?? "";
    const result = await gradeExamAnswer({
      bundle: ctx.bundle!,
      selectedIndex,
      correctIndex,
    });

    if (result.kind === "blocked") {
      await ctx.editMessageText(result.text);
      return;
    }

    if (result.kind === "finished") {
      const locale = ctx.bundle!.settings.uiLocale as UiLocale;
      await ctx.editMessageText(`${previous}\n\n${result.feedback}\n\n${result.text}`);
      if (result.missedCount > 0) {
        await ctx.reply(t(locale, "examPrioritizeAsk"), {
          reply_markup: examMissKeyboard(locale),
        });
      }
      return;
    }

    await ctx.editMessageText(`${previous}\n\n${result.feedback}`);
    await ctx.reply(result.text, {
      reply_markup: examMcqKeyboard(result.options, result.correctIndex),
    });
  });

  bot.callbackQuery("exam:prio:yes", async (ctx) => {
    await ctx.answerCallbackQuery();
    const { text } = await prioritizeExamMisses(ctx.bundle!);
    await ctx.editMessageText(text);
  });

  bot.callbackQuery("exam:prio:no", async (ctx) => {
    await ctx.answerCallbackQuery();
    const { text } = dismissExamMisses(ctx.bundle!);
    await ctx.editMessageText(text);
  });

  bot.callbackQuery("settings:vacation", async (ctx) => {
    const next = !ctx.bundle!.settings.vacationMode;
    await updateUserSettings(ctx.bundle!.user.id, { vacationMode: next });
    ctx.bundle!.settings.vacationMode = next;
    await ctx.answerCallbackQuery(next ? "Vacation ON" : "Vacation OFF");
    await handleSettings(ctx);
  });

  bot.callbackQuery("settings:limit", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(t(ctx.bundle!.settings.uiLocale as UiLocale, "chooseDailyLimit"), {
      reply_markup: dailyLimitKeyboard(),
    });
  });

  bot.callbackQuery("settings:direction", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(t(ctx.bundle!.settings.uiLocale as UiLocale, "chooseDirection"), {
      reply_markup: directionKeyboard(),
    });
  });

  bot.callbackQuery("settings:locale", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(t(ctx.bundle!.settings.uiLocale as UiLocale, "chooseLocale"), {
      reply_markup: localeKeyboard(),
    });
  });

  return bot;
};

const isAction = (text: string, needles: string[]): boolean =>
  needles.some((needle) => text.includes(needle));

const handleLearn = async (ctx: BotContext): Promise<void> => {
  if (!(await ensureOnboarded(ctx))) {
    return;
  }

  await replyQuizResult(ctx, await startLearn(ctx.bundle!));
};

const handleReview = async (ctx: BotContext): Promise<void> => {
  if (!(await ensureOnboarded(ctx))) {
    return;
  }

  await replyQuizResult(ctx, await startReview(ctx.bundle!));
};

const handlePractice = async (ctx: BotContext): Promise<void> => {
  if (!(await ensureOnboarded(ctx))) {
    return;
  }

  await replyQuizResult(ctx, await startPractice(ctx.bundle!));
};

const handleExamMenu = async (ctx: BotContext): Promise<void> => {
  if (!(await ensureOnboarded(ctx))) {
    return;
  }

  const locale = ctx.bundle!.settings.uiLocale as UiLocale;
  await ctx.reply(t(locale, "examChooseMode"), {
    reply_markup: examModeKeyboard(locale),
  });
};

const handleReport = async (ctx: BotContext): Promise<void> => {
  if (!(await ensureOnboarded(ctx))) {
    return;
  }

  await ctx.reply(await buildDiagnosticsReport(ctx.bundle!));
};

const handleWeak = async (ctx: BotContext): Promise<void> => {
  if (!(await ensureOnboarded(ctx))) {
    return;
  }

  await replyQuizResult(ctx, await startWeakDrill(ctx.bundle!));
};

const handleStats = async (ctx: BotContext): Promise<void> => {
  if (!(await ensureOnboarded(ctx))) {
    return;
  }

  const bundle = ctx.bundle!;
  const locale = bundle.settings.uiLocale as UiLocale;
  const due = await countDueCards(bundle.user.id);
  const usageDate = localDateString(new Date(), bundle.settings.timezone);
  const usage = await getOrCreateDailyUsage(bundle.user.id, usageDate);

  await ctx.reply(
    t(locale, "stats", {
      streak: bundle.user.streakCount,
      due,
      newToday: usage.newWordsIntroduced,
      newLimit: bundle.settings.dailyNewLimit,
      reviewsToday: usage.reviewsCompleted,
    }),
  );
};

const handleSettings = async (ctx: BotContext): Promise<void> => {
  if (!(await ensureOnboarded(ctx))) {
    return;
  }

  const bundle = ctx.bundle!;
  const locale = bundle.settings.uiLocale as UiLocale;
  await ctx.reply(
    t(locale, "settings", {
      locale: bundle.settings.uiLocale,
      level: bundle.settings.cefrLevel,
      newLimit: bundle.settings.dailyNewLimit,
      direction: bundle.settings.practiceDirection,
      vacation: bundle.settings.vacationMode ? "ON" : "OFF",
    }),
    { reply_markup: settingsKeyboard(locale) },
  );
};

const ensureOnboarded = async (ctx: BotContext): Promise<boolean> => {
  if (ctx.bundle?.user.onboardingCompletedAt) {
    return true;
  }

  await ctx.reply(t("fa", "chooseLocale"), { reply_markup: localeKeyboard() });
  return false;
};

const replyQuizResult = async (
  ctx: BotContext,
  result: LearnResult | ReviewResult,
): Promise<void> => {
  if (result.kind !== "card") {
    await ctx.reply(result.text);
    return;
  }

  await ctx.reply(result.text, {
    reply_markup: mcqKeyboard(
      result.mode,
      result.cardId,
      result.direction,
      result.options,
      result.correctIndex,
    ),
  });
};
