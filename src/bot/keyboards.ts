import { InlineKeyboard, Keyboard } from "grammy";

/**
 * Persistent reply keyboard for the home screen.
 */
export const homeKeyboard = (locale: "fa" | "en"): Keyboard => {
  const labels =
    locale === "fa"
      ? [
          "📚 یادگیری",
          "🔁 مرور",
          "📝 آزمون",
          "🧪 تمرین",
          "🎯 ضعیف‌ها",
          "📈 گزارش",
          "📊 آمار",
          "⚙️ تنظیمات",
        ]
      : [
          "📚 Learn",
          "🔁 Review",
          "📝 Exam",
          "🧪 Practice",
          "🎯 Weak",
          "📈 Report",
          "📊 Stats",
          "⚙️ Settings",
        ];

  return new Keyboard()
    .text(labels[0]!)
    .text(labels[1]!)
    .row()
    .text(labels[2]!)
    .text(labels[3]!)
    .row()
    .text(labels[4]!)
    .text(labels[5]!)
    .row()
    .text(labels[6]!)
    .text(labels[7]!)
    .resized()
    .persistent();
};

export const localeKeyboard = (): InlineKeyboard =>
  new InlineKeyboard().text("English", "onboard:locale:en").text("فارسی", "onboard:locale:fa");

export const levelKeyboard = (): InlineKeyboard =>
  new InlineKeyboard()
    .text("A1", "onboard:level:A1")
    .text("A2", "onboard:level:A2")
    .text("B1", "onboard:level:B1")
    .row()
    .text("B2", "onboard:level:B2")
    .text("C1", "onboard:level:C1");

export const dailyLimitKeyboard = (): InlineKeyboard =>
  new InlineKeyboard()
    .text("5", "onboard:limit:5")
    .text("10", "onboard:limit:10")
    .text("20", "onboard:limit:20");

export const directionKeyboard = (): InlineKeyboard =>
  new InlineKeyboard()
    .text("EN→FA", "onboard:dir:en_to_fa")
    .text("FA→EN", "onboard:dir:fa_to_en")
    .text("Mixed", "onboard:dir:mixed");

export const settingsKeyboard = (locale: "fa" | "en"): InlineKeyboard => {
  const vacation = locale === "fa" ? "مرخصی روشن/خاموش" : "Toggle vacation";
  const limit = locale === "fa" ? "حد روزانه" : "Daily limit";
  const direction = locale === "fa" ? "جهت تمرین" : "Direction";
  const ui = locale === "fa" ? "زبان رابط" : "UI language";

  return new InlineKeyboard()
    .text(limit, "settings:limit")
    .text(direction, "settings:direction")
    .row()
    .text(ui, "settings:locale")
    .text(vacation, "settings:vacation");
};

export const examModeKeyboard = (locale: "fa" | "en"): InlineKeyboard => {
  const quick = locale === "fa" ? "سریع (۱۰)" : "Quick (10)";
  const standard = locale === "fa" ? "عادی (۲۰)" : "Standard (20)";
  const history = locale === "fa" ? "تاریخچه" : "History";

  return new InlineKeyboard()
    .text(quick, "exam:mode:quick")
    .text(standard, "exam:mode:standard")
    .row()
    .text(history, "exam:history");
};

export const examMissKeyboard = (locale: "fa" | "en"): InlineKeyboard => {
  const yes = locale === "fa" ? "بله، اولویت بده" : "Yes, prioritize";
  const no = locale === "fa" ? "نه" : "No";
  return new InlineKeyboard().text(yes, "exam:prio:yes").text(no, "exam:prio:no");
};

/**
 * Builds an MCQ inline keyboard for learn/review/practice answers.
 */
export const mcqKeyboard = (
  prefix: "learn" | "review" | "practice" | "weak",
  cardId: string,
  direction: string,
  options: string[],
  correctIndex: number,
): InlineKeyboard => {
  const keyboard = new InlineKeyboard();
  options.forEach((option, index) => {
    keyboard
      .text(option, `${prefix}:ans:${cardId}:${direction}:${correctIndex}:${index}`)
      .row();
  });
  return keyboard;
};

/**
 * Compact exam MCQ keyboard (session holds question state).
 */
export const examMcqKeyboard = (
  options: string[],
  correctIndex: number,
): InlineKeyboard => {
  const keyboard = new InlineKeyboard();
  options.forEach((option, index) => {
    keyboard.text(option, `exam:ans:${correctIndex}:${index}`).row();
  });
  return keyboard;
};
