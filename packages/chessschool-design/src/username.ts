import { isRude } from "./social";

/**
 * Usernames (Phase 5) replace friend codes: every account has one, unique ignoring case, shown as @name.
 * New ones are made from the first name ("Asha Rao" -> "asha4821"); the learner can change it any time.
 */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export type UsernameProblem = "length" | "chars" | "reserved" | "rude" | "taken";

/** Lower-case letters, digits, underscore and dot; starts with a letter or digit, no dot at the end or twice in a row. */
const USERNAME_RE = /^[a-z0-9][a-z0-9_.]*$/;
/** Words and routes nobody may take (they would look official or clash with a page). */
const RESERVED = new Set([
  "admin", "administrator", "root", "system", "support", "help", "helpdesk", "staff", "team", "mod", "mods", "moderator", "official",
  "chessschool", "chess_school", "chess.school", "chaukor", "coach", "bot", "bots", "api", "www", "mail", "email", "app", "web",
  "me", "you", "null", "undefined", "anonymous", "guest", "player", "settings", "login", "signup", "signin", "logout", "account",
  "profile", "friends", "leaderboard", "league", "privacy", "terms", "about", "contact", "security", "everyone", "here",
]);
const RESERVED_INSIDE = ["chessschool", "chaukor", "admin", "moderator", "official"];

/** The form a username is stored and compared in. */
export const normalizeUsername = (raw: string) => raw.trim().replace(/^@+/, "").toLowerCase();

/** Why `raw` can't be a username (before the uniqueness check), or null when it is fine. */
export function usernameProblem(raw: string): UsernameProblem | null {
  const u = normalizeUsername(raw);
  if (u.length < USERNAME_MIN || u.length > USERNAME_MAX) return "length";
  if (!USERNAME_RE.test(u) || u.endsWith(".") || u.includes("..")) return "chars";
  const bare = u.replace(/[_.]/g, "");
  if (RESERVED.has(u) || RESERVED.has(bare) || RESERVED_INSIDE.some((w) => bare.includes(w))) return "reserved";
  // Digits split words too, so "shit4821" is caught as well as "xfuckx".
  if (isRude(u.replace(/[_.]/g, " ")) || isRude(bare) || isRude(u.replace(/[^a-z]+/g, " "))) return "rude";
  return null;
}

/** Up to four ASCII letters from the first name ("Ásha" -> "asha"); "chess" when it has fewer than two Latin letters. */
export function usernameBase(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? "";
  const letters = first
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/[^a-z]/g, "")
    .slice(0, 4);
  const base = letters.length >= 2 ? letters : "chess";
  return usernameProblem(`${base}0000`) ? "chess" : base;
}

/** A fresh suggestion: the name's base and four digits ("asha4821"). `random` returns [0, 1). */
export function suggestUsername(name: string, random: () => number = Math.random, digits = 4): string {
  const n = Math.floor(random() * 10 ** digits);
  return `${usernameBase(name)}${String(n).padStart(digits, "0")}`;
}
