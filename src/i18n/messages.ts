import type { UiLocale } from "../domain/types.js";

type MessageKey =
  | "welcomeBack"
  | "chooseLocale"
  | "chooseLevel"
  | "chooseDailyLimit"
  | "chooseDirection"
  | "onboardingDone"
  | "home"
  | "help"
  | "learnQuotaEmpty"
  | "learnQuotaEmptyNoDue"
  | "vacationOn"
  | "noDueReviews"
  | "noDueReviewsEta"
  | "practiceAhead"
  | "noCardsYet"
  | "reviewCapReached"
  | "sessionDone"
  | "wordIntro"
  | "reviewPromptEnToFa"
  | "reviewPromptFaToEn"
  | "correct"
  | "incorrect"
  | "stats"
  | "settings"
  | "unknown"
  | "reminder"
  | "examChooseMode"
  | "examNoWords"
  | "examTooFew"
  | "examProgress"
  | "examFinished"
  | "examPrioritizeAsk"
  | "examPrioritized"
  | "examMissesSkipped"
  | "examNotActive"
  | "examHistoryTitle"
  | "examHistoryEmpty"
  | "reportTitle"
  | "reportDue"
  | "reportAccuracy"
  | "reportWeakCount"
  | "reportLeechCount"
  | "reportDirectionBias"
  | "reportDirectionOk"
  | "reportWeakList"
  | "reportLeechList"
  | "reportSuggestReviewDebt"
  | "reportSuggestDirection"
  | "reportSuggestCramming"
  | "reportSuggestWeak"
  | "weakAhead"
  | "weakEmpty"
  | "weakInterleave";

const fa: Record<MessageKey, string> = {
  welcomeBack: "خوش آمدید! از منوی زیر یک گزینه را انتخاب کنید.",
  chooseLocale: "زبان رابط را انتخاب کنید:",
  chooseLevel: "سطح فعلی‌تان را انتخاب کنید:",
  chooseDailyLimit: "هر روز چند واژهٔ جدید می‌خواهید؟",
  chooseDirection: "جهت تمرین را انتخاب کنید:",
  onboardingDone: "عالی! آماده‌اید. از منوی زیر شروع کنید.",
  home: "خانه\n📋 سررسید الان: {due}\n🆕 باقی‌مانده واژه جدید: {newLeft}\n🔥 استریک: {streak}",
  help:
    "چطور کار می‌کند:\n📚 یادگیری\n🔁 مرور\n📝 آزمون\n🧪 تمرین\n🎯 ضعیف‌ها\n📈 گزارش\n\n/learn /review /exam /practice /weak /report /stats /settings",
  learnQuotaEmpty: "سهمیه واژه‌های جدید امروز تمام شد. الان مرور را بزنید.",
  learnQuotaEmptyNoDue:
    "سهمیه واژه‌های جدید امروز تمام شد و هنوز کارتی سررسید نیست. کمی صبر کنید یا تمرین را بزنید.",
  vacationOn: "حالت مرخصی روشن است. یادگیری جدید متوقف شده.",
  noDueReviews: "الان کارت سررسیدی ندارید.",
  noDueReviewsEta:
    "الان کارت سررسیدی ندارید.\nزمان بعدی: {when}\nبرای مرور آزاد: تمرین",
  practiceAhead: "🧪 تمرین آزاد (زمان‌بندی SRS عوض نمی‌شود):",
  noCardsYet: "هنوز واژه‌ای یاد نگرفته‌اید. اول یادگیری را بزنید.",
  reviewCapReached: "به سقف مرور امروز رسیدید.",
  sessionDone: "پایان جلسه. آفرین!",
  wordIntro:
    "🆕 {lemma} ({pos})\nمعنی: {gloss}\nمثال: {exampleEn}\nترجمه: {exampleFa}",
  reviewPromptEnToFa: "معنی فارسی چیست؟\n\n🇬🇧 {lemma}",
  reviewPromptFaToEn: "معادل انگلیسی چیست؟\n\n🇮🇷 {gloss}",
  correct: "✅ درست!",
  incorrect: "❌ نادرست. پاسخ: {answer}",
  stats:
    "📊 آمار\nاستریک: {streak}\nسررسید: {due}\nامروز جدید: {newToday}/{newLimit}\nامروز مرور: {reviewsToday}",
  settings:
    "⚙️ تنظیمات\nزبان: {locale}\nسطح: {level}\nحد جدید: {newLimit}\nجهت: {direction}\nمرخصی: {vacation}",
  unknown: "متوجه نشدم. /help را بزنید.",
  reminder: "⏰ یادآوری: {due} کارت برای مرور آماده است. /review",
  examChooseMode: "نوع آزمون را انتخاب کنید (فقط از واژه‌هایی که تمرین کرده‌اید):",
  examNoWords: "هنوز واژه تمرین‌شده‌ای ندارید. اول یادگیری و مرور کنید.",
  examTooFew: "واژه‌های تمرین‌شده کافی نیست ({have}). حداقل {need} واژه لازم است.",
  examProgress: "📝 آزمون {current}/{total}",
  examFinished: "🏁 پایان آزمون\nنتیجه: {correct}/{total}\nغلط‌ها: {missed}",
  examPrioritizeAsk: "غلط‌ها به صف مرور اولویت‌دار اضافه شوند؟",
  examPrioritized: "{count} واژه به مرور اولویت‌دار اضافه شد. /review را بزنید.",
  examMissesSkipped: "باشه. غلط‌ها اولویت نشدند.",
  examNotActive: "آزمون فعالی نیست. /exam را بزنید.",
  examHistoryTitle: "تاریخچه آزمون‌ها:",
  examHistoryEmpty: "هنوز آزمونی ثبت نشده است.",
  reportTitle: "📈 گزارش تشخیصی (۳۰ روز)",
  reportDue: "سررسید الان: {due}",
  reportAccuracy: "دقت کلی: {rate}",
  reportWeakCount: "واژه‌های ضعیف: {count}",
  reportLeechCount: "لیچ‌ها (سخت‌جان): {count}",
  reportDirectionBias: "سوگیری جهت: {weaker} ضعیف‌تر از {stronger} (اختلاف {gap})",
  reportDirectionOk: "جهت تمرین متعادل به نظر می‌رسد.",
  reportWeakList: "ضعیف‌ترین‌ها:",
  reportLeechList: "لیچ‌ها:",
  reportSuggestReviewDebt: "پیشنهاد: اول مرور را خلوت کنید؛ واژه جدید را کم کنید.",
  reportSuggestDirection: "پیشنهاد: برای چند روز جهت ضعیف‌تر / Mixed را بیشتر تمرین کنید.",
  reportSuggestCramming: "پیشنهاد: جلسه را کوتاه‌تر کنید؛ چند Again پشت‌سرهم دیدم.",
  reportSuggestWeak: "پیشنهاد: دکمه ضعیف‌ها را برای تمرکز روی همین واژه‌ها بزنید.",
  weakAhead: "🎯 تمرین واژه‌های ضعیف:",
  weakEmpty: "واژه ضعیفی پیدا نشد. عالی است! کمی Learn/Review کنید تا داده جمع شود.",
  weakInterleave: "🎯 یادآوری واژه ضعیف:",
};

const en: Record<MessageKey, string> = {
  welcomeBack: "Welcome back! Pick an option below.",
  chooseLocale: "Choose your UI language:",
  chooseLevel: "Choose your current level:",
  chooseDailyLimit: "How many new words per day?",
  chooseDirection: "Choose practice direction:",
  onboardingDone: "You're set. Use the menu below to begin.",
  home: "Home\n📋 Due now: {due}\n🆕 New left: {newLeft}\n🔥 Streak: {streak}",
  help:
    "How it works:\n📚 Learn\n🔁 Review\n📝 Exam\n🧪 Practice\n🎯 Weak\n📈 Report\n\n/learn /review /exam /practice /weak /report /stats /settings",
  learnQuotaEmpty: "No new-word quota left today. Do Review now.",
  learnQuotaEmptyNoDue:
    "No new-word quota left and nothing is due yet. Wait a bit, or use Practice.",
  vacationOn: "Vacation mode is on. New learning is paused.",
  noDueReviews: "Nothing is due right now.",
  noDueReviewsEta:
    "Nothing is due right now.\nNext card: {when}\nFor free drill: Practice",
  practiceAhead: "🧪 Free practice (SRS schedule unchanged):",
  noCardsYet: "You have not learned any words yet. Tap Learn first.",
  reviewCapReached: "You hit today's review cap.",
  sessionDone: "Session complete. Nice work!",
  wordIntro:
    "🆕 {lemma} ({pos})\nMeaning: {gloss}\nExample: {exampleEn}\nTranslation: {exampleFa}",
  reviewPromptEnToFa: "What is the Persian meaning?\n\n🇬🇧 {lemma}",
  reviewPromptFaToEn: "What is the English word?\n\n🇮🇷 {gloss}",
  correct: "✅ Correct!",
  incorrect: "❌ Incorrect. Answer: {answer}",
  stats:
    "📊 Stats\nStreak: {streak}\nDue: {due}\nNew today: {newToday}/{newLimit}\nReviews today: {reviewsToday}",
  settings:
    "⚙️ Settings\nLocale: {locale}\nLevel: {level}\nNew limit: {newLimit}\nDirection: {direction}\nVacation: {vacation}",
  unknown: "I didn't catch that. Try /help.",
  reminder: "⏰ Reminder: {due} cards are due. /review",
  examChooseMode: "Choose exam type (practiced words only):",
  examNoWords: "No practiced words yet. Learn and review first.",
  examTooFew: "Not enough practiced words ({have}). Need at least {need}.",
  examProgress: "📝 Exam {current}/{total}",
  examFinished: "🏁 Exam finished\nScore: {correct}/{total}\nMisses: {missed}",
  examPrioritizeAsk: "Add misses to priority review?",
  examPrioritized: "Added {count} word(s) to priority review. Tap Review.",
  examMissesSkipped: "OK — misses were not prioritized.",
  examNotActive: "No active exam. Use /exam.",
  examHistoryTitle: "Exam history:",
  examHistoryEmpty: "No exams yet.",
  reportTitle: "📈 Diagnostics report (30 days)",
  reportDue: "Due now: {due}",
  reportAccuracy: "Overall accuracy: {rate}",
  reportWeakCount: "Weak words: {count}",
  reportLeechCount: "Leeches: {count}",
  reportDirectionBias: "Direction bias: {weaker} weaker than {stronger} (gap {gap})",
  reportDirectionOk: "Practice directions look balanced.",
  reportWeakList: "Weakest words:",
  reportLeechList: "Leeches:",
  reportSuggestReviewDebt: "Suggestion: clear reviews first; lower new-word limit.",
  reportSuggestDirection: "Suggestion: practice the weaker direction / Mixed for a few days.",
  reportSuggestCramming: "Suggestion: shorten sessions — several Again grades in a row.",
  reportSuggestWeak: "Suggestion: tap Weak to focus on these words.",
  weakAhead: "🎯 Weak-word drill:",
  weakEmpty: "No weak words found yet. Keep learning/reviewing to gather data.",
  weakInterleave: "🎯 Weak-word reminder:",
};

const catalogs: Record<UiLocale, Record<MessageKey, string>> = { fa, en };

/**
 * Formats a localized message with simple `{token}` interpolation.
 */
export const t = (
  locale: UiLocale,
  key: MessageKey,
  vars: Record<string, string | number> = {},
): string => {
  const template = catalogs[locale][key] ?? catalogs.en[key];
  return Object.entries(vars).reduce(
    (value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)),
    template,
  );
};

export type { MessageKey };
