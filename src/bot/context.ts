import type { Context } from "grammy";
import type { UserBundle } from "../repositories/users-repository.js";

export type BotContext = Context & {
  bundle?: UserBundle;
};
