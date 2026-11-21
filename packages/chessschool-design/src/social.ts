import { cleanName } from "./api";
import type { AvatarId } from "./progress";

/* ---------- display names ---------- */

export type NameProblem = "empty" | "long" | "chars" | "link" | "reserved" | "rude";
export const NAME_MAX = 40;

/** Leetspeak and look-alikes folded before matching ("sh1t", "f@ck"). */
const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "@": "a", $: "s", "!": "i" };
const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[013457@$!8]/g, (ch) => LEET[ch] ?? ch);
/** Long runs of one letter count once ("fuuuck"); the lists below are folded the same way. */
const collapse = (s: string) => s.replace(/(\p{L})\1+/gu, "$1");
const lettersOnly = (s: string) => s.replace(/[^\p{L}\p{M}]/gu, "");
/** Folded letters with everything else removed: how names and the lists below are compared. */
const key = (s: string) => collapse(lettersOnly(fold(s)));
const wordsOf = (s: string) => fold(s).split(/[^\p{L}\p{M}]+/u).filter(Boolean).map(collapse);

/** Words rude anywhere inside a name ("xfuckx"): long and unambiguous, so innocent names never contain them. */
const RUDE_INSIDE = [
  "fuck", "motherfuck", "nigger", "nigga", "faggot", "bitch", "whore", "pussy", "asshole", "rapist",
  // Hinglish
  "bhenchod", "behenchod", "benchod", "madarchod", "maderchod", "madharchod", "chutiya", "chutiye", "chootiya", "bhosdi", "bhosda", "bhosad", "gandu", "gaandu", "randwa",
  // Hindi
  "चूतिया", "चुतिया", "भेनचोद", "बहनचोद", "मादरचोद", "भोसड़ी", "भोसडी", "गांडू", "गाँडू", "लौड़ा", "लोड़ा", "रंडी", "हरामी", "हरामज़ादा", "कमीना",
].map(key);
/** Words rude only as a whole word ("Dick" alone, never "Dickens"; "Ashita" is fine). */
const RUDE_WORD = new Set(
  [
    "shit", "sex", "sexy", "porn", "dick", "cock", "cunt", "slut", "rape", "hitler", "bastard", "penis", "boobs", "nude", "nudes", "horny", "wanker",
    "chut", "choot", "lund", "loda", "lauda", "lodu", "harami", "haramzada", "kamina", "kamine", "kaminey", "randi", "bsdk", "bkl", "mkc", "tatti", "suar", "kutta", "kutti", "kuttiya",
    "चूत", "लंड", "टट्टी", "कुत्ता", "कुत्ती", "सूअर",
  ].map(key),
);
/** Names only staff accounts may use (compared without spaces, case or punctuation). */
const RESERVED_INSIDE = ["chessschool", "chaukor", "चौकोर", "moderator", "official"].map(key);
/** Reserved at the start of any word ("AdminRiya", but not "Badminton"). */
const RESERVED_START = ["admin"].map(key);
const RESERVED_WORD = new Set(["mod", "mods", "support", "staff", "system", "team", "helpdesk"].map(key));

const LINK = /(https?:|www\.|[a-z0-9-]\.(com|in|net|org|io|me|gg|ly|app|xyz|co|tv|link|site|online|shop)\b|@\w|\b(t\.me|wa\.me|bit\.ly)\b)/i;
/** Six or more digits in a row (a phone number), counting spaces and dashes between them. */
const PHONE = /\d(?:[\s-]?\d){5,}/;
/** Letters (any script, with marks), digits, spaces and a little punctuation. */
const NAME_CHARS = /^[\p{L}\p{M}\p{Nd} .'’-]+$/u;

/** True when the text uses a rude word (English, Hinglish or Hindi). Exported for bios and other short text. */
export function isRude(text: string): boolean {
  const joined = key(text);
  if (RUDE_INSIDE.some((w) => w && joined.includes(w))) return true;
  const words = wordsOf(text);
  // Spaced-out letters ("f u c k") are caught by the joined check above; single words here.
  return words.some((w) => RUDE_WORD.has(w)) || RUDE_WORD.has(joined);
}

/** True for a link, an @handle or a phone number in free text. */
export const hasContact = (text: string) => LINK.test(text) || PHONE.test(text);

/**
 * Why a display name can't be used, or null when it is fine. Applied by the server wherever a name is set;
 * forms call it too so the learner sees the reason before saving. `staff` (admin accounts) may use reserved names.
 */
export function nameProblem(raw: string, opts: { staff?: boolean } = {}): NameProblem | null {
  const spaced = raw.replace(/\s+/g, " ").trim();
  if (!spaced) return "empty";
  if (spaced.length > NAME_MAX) return "long";
  if (hasContact(spaced)) return "link";
  if (!NAME_CHARS.test(spaced) || !/\p{L}/u.test(spaced)) return "chars";
  if (isRude(spaced)) return "rude";
  if (!opts.staff) {
    const joined = key(spaced);
    const words = wordsOf(spaced);
    if (RESERVED_INSIDE.some((w) => joined.includes(w)) || RESERVED_WORD.has(joined) || words.every((w) => RESERVED_WORD.has(w)) || words.some((w) => RESERVED_START.some((r) => w.startsWith(r)))) return "reserved";
  }
  return null;
}

/** A name from Google or Apple: kept when it passes, else dropped (the learner picks one later) instead of failing sign-in. */
export const providerName = (raw: string, opts: { staff?: boolean } = {}) => {
  const name = cleanName(raw);
  return name && !nameProblem(name, opts) ? name : "";
};

/* ---------- public profile ---------- */

export const PIECES = ["king", "queen", "rook", "bishop", "knight", "pawn"] as const;
export type PieceId = (typeof PIECES)[number];
/** Profile banner colours: palette keys from tokens.ts. */
export const BANNERS = ["brand", "accent", "gold", "success", "brandText", "boardDark"] as const;
export type BannerId = (typeof BANNERS)[number];
export const SOCIALS = ["instagram", "facebook", "x", "youtube", "lichess", "chesscom"] as const;
export type SocialNetwork = (typeof SOCIALS)[number];
export type Socials = Partial<Record<SocialNetwork, string>>;

export const BIO_MAX = 160;
export const SHORT_MAX = 40;
export const GOAL_MAX = 80;
export const FIRST_YEAR = 1950;

/** What a learner adds to their profile beyond name, avatar and country. Every field is optional. */
export type ProfileDetails = {
  bio: string;
  favPiece: PieceId | null;
  favOpening: string;
  goal: string;
  playingSince: number | null;
  city: string;
  banner: BannerId | null;
  socials: Socials;
};
export const emptyDetails = (): ProfileDetails => ({ bio: "", favPiece: null, favOpening: "", goal: "", playingSince: null, city: "", banner: null, socials: {} });

const HANDLE: Record<SocialNetwork, RegExp> = {
  instagram: /^(?!.*\.\.)[A-Za-z0-9._]{1,30}$/,
  facebook: /^[A-Za-z0-9.]{5,50}$/,
  x: /^[A-Za-z0-9_]{1,15}$/,
  youtube: /^[A-Za-z0-9._-]{3,30}$/,
  lichess: /^[A-Za-z0-9][A-Za-z0-9_-]{1,19}$/,
  chesscom: /^[A-Za-z0-9][A-Za-z0-9_-]{2,24}$/,
};
const HOSTS: Record<SocialNetwork, RegExp> = {
  instagram: /^(www\.)?instagram\.com$/,
  facebook: /^((www|m)\.)?facebook\.com$|^fb\.com$/,
  x: /^(www\.)?(x|twitter)\.com$/,
  youtube: /^((www|m)\.)?youtube\.com$/,
  lichess: /^(www\.)?lichess\.org$/,
  chesscom: /^(www\.)?chess\.com$/,
};

/**
 * A username as typed or pasted ("@riya", "instagram.com/riya", a full profile link) reduced to the bare handle,
 * or null when it isn't one. "" means the field was cleared.
 */
export function cleanHandle(network: SocialNetwork, raw: string): string | null {
  let v = raw.trim();
  if (!v) return "";
  const url = /^(?:https?:\/\/)?([^/\s]+)\/(.+)$/i.exec(v);
  if (url) {
    if (!HOSTS[network].test(url[1]!.toLowerCase())) return null;
    const parts = url[2]!.split(/[/?#]/).filter(Boolean);
    // lichess.org/@/name, chess.com/member/name, youtube.com/@name
    v = parts[0] === "@" || parts[0] === "member" ? (parts[1] ?? "") : (parts[0] ?? "");
  }
  v = v.replace(/^@/, "");
  return HANDLE[network].test(v) ? v : null;
}

export function socialUrl(network: SocialNetwork, handle: string): string {
  const h = encodeURIComponent(handle);
  switch (network) {
    case "instagram":
      return `https://www.instagram.com/${h}`;
    case "facebook":
      return `https://www.facebook.com/${h}`;
    case "x":
      return `https://x.com/${h}`;
    case "youtube":
      return `https://www.youtube.com/@${h}`;
    case "lichess":
      return `https://lichess.org/@/${h}`;
    case "chesscom":
      return `https://www.chess.com/member/${h}`;
  }
}

export type DetailsProblem = { field: keyof ProfileDetails | `socials.${SocialNetwork}`; reason: "long" | "link" | "rude" | "invalid" };

/** Free text the profile shows: no links or phone numbers (those belong in the handle fields), nothing rude. */
const textProblem = (v: string, max: number): DetailsProblem["reason"] | null => (v.length > max ? "long" : hasContact(v) ? "link" : isRude(v) ? "rude" : null);

/**
 * Checks and tidies profile details from a form or a request body. Returns the clean details, or the first problem.
 * Unknown fields are dropped; missing fields keep their `base` value.
 */
export function checkDetails(input: unknown, base: ProfileDetails, year: number): { details: ProfileDetails } | { problem: DetailsProblem } {
  const b = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: ProfileDetails = { ...base, socials: { ...base.socials } };
  const text = (key: "bio" | "favOpening" | "goal" | "city", max: number): DetailsProblem | null => {
    if (b[key] === undefined) return null;
    if (typeof b[key] !== "string") return { field: key, reason: "invalid" };
    const v = (b[key] as string).replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    const reason = textProblem(v, max);
    if (reason) return { field: key, reason };
    out[key] = v;
    return null;
  };
  for (const [key, max] of [["bio", BIO_MAX], ["favOpening", SHORT_MAX], ["goal", GOAL_MAX], ["city", SHORT_MAX]] as const) {
    const p = text(key, max);
    if (p) return { problem: p };
  }
  if (b.city !== undefined && out.city && !NAME_CHARS.test(out.city)) return { problem: { field: "city", reason: "invalid" } };
  if (b.favPiece !== undefined) {
    if (b.favPiece !== null && !PIECES.includes(b.favPiece as PieceId)) return { problem: { field: "favPiece", reason: "invalid" } };
    out.favPiece = (b.favPiece as PieceId | null) ?? null;
  }
  if (b.banner !== undefined) {
    if (b.banner !== null && !BANNERS.includes(b.banner as BannerId)) return { problem: { field: "banner", reason: "invalid" } };
    out.banner = (b.banner as BannerId | null) ?? null;
  }
  if (b.playingSince !== undefined) {
    const y = b.playingSince;
    if (y !== null && !(Number.isInteger(y) && (y as number) >= FIRST_YEAR && (y as number) <= year)) return { problem: { field: "playingSince", reason: "invalid" } };
    out.playingSince = (y as number | null) ?? null;
  }
  if (b.socials !== undefined) {
    if (!b.socials || typeof b.socials !== "object") return { problem: { field: "socials", reason: "invalid" } };
    const s = b.socials as Record<string, unknown>;
    for (const network of SOCIALS) {
      if (s[network] === undefined) continue;
      const handle = typeof s[network] === "string" ? cleanHandle(network, s[network] as string) : s[network] === null ? "" : null;
      if (handle === null) return { problem: { field: `socials.${network}`, reason: "invalid" } };
      if (handle) out.socials[network] = handle;
      else delete out.socials[network];
    }
  }
  return { details: out };
}

/* ---------- wire types ---------- */

export type PlayerReportReason = "name" | "photo" | "behaviour" | "cheating" | "other";
export const PLAYER_REPORT_REASONS: readonly PlayerReportReason[] = ["name", "photo", "behaviour", "cheating", "other"];

/** GET /v1/players/:id: what anyone signed in may see of an account. City and social links are left out for a child's account. */
export type PlayerProfile = {
  id: string;
  name: string;
  avatar: AvatarId;
  photo: string | null;
  country: string | null;
  details: ProfileDetails;
  rating: number | null;
  xp: number;
  joinedAt: number;
  friend: boolean;
  me: boolean;
};
/** GET /v1/me/details: your own details and photo (the photo is null while it is hidden after reports). */
export type MyDetails = { details: ProfileDetails; photo: string | null; photoHidden: boolean };
export type BlockedPlayer = { id: string; name: string; avatar: AvatarId; at: number };
export type SupportTopic = "problem" | "question" | "idea" | "account";
export const SUPPORT_TOPICS: readonly SupportTopic[] = ["problem", "question", "idea", "account"];
export type SafetyAction = "dismiss" | "hide_name" | "hide_photo" | "suspend" | "unsuspend" | "reopen";
/** One row of the admin safety queue (class and player reports). */
export type SafetyReport = {
  id: string;
  reason: string;
  note: string;
  status: "open" | "resolved";
  createdAt: number;
  className: string | null;
  reportedId: string;
  reported: string | null;
  reportedPhoto: string | null;
  reportedSuspended: boolean;
  reporter: string | null;
  /** Open reports about the same account. */
  openAboutThem: number;
};
export type SupportMessage = { id: string; topic: SupportTopic; message: string; email: string | null; platform: string; version: string; createdAt: number; account: string | null };
