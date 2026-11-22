import { copy } from "./copy";
import { hi } from "./copy.hi";

export const LANGS = ["en", "hi"] as const;
export type Lang = (typeof LANGS)[number];
export const LANG_NAMES: Record<Lang, string> = { en: "English", hi: "हिन्दी" };
export const isLang = (v: unknown): v is Lang => LANGS.includes(v as Lang);

/** A translation: any subset of `copy`, same shape, with plain strings instead of the English literals. */
type Widen<T> = T extends string ? string : T extends (...a: infer A) => infer R ? (...a: A) => Widen<R> : T extends readonly (infer U)[] ? readonly Widen<U>[] : T extends object ? { [K in keyof T]?: Widen<T[K]> } : T;
export type Translation = Widen<typeof copy>;

type Tree = Record<string, unknown>;
const isTree = (v: unknown): v is Tree => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const clone = (o: Tree): Tree => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, isTree(v) ? clone(v) : v]));
/** Writes `src` into `dst` in place, so references to nested copy objects stay valid. */
function assign(dst: Tree, src: Tree) {
  for (const [k, v] of Object.entries(src)) {
    if (isTree(v) && isTree(dst[k])) assign(dst[k] as Tree, v);
    else if (v !== undefined) dst[k] = v;
  }
}

const en = clone(copy as unknown as Tree);
let current: Lang = "en";

/** Switches every `copy.*` string to `lang`; lines without a translation stay English. */
export function setLanguage(lang: Lang) {
  if (lang === current) return;
  assign(copy as unknown as Tree, clone(en));
  if (lang === "hi") assign(copy as unknown as Tree, hi as Tree);
  current = lang;
}
export const language = () => current;

/** The app language for a device locale such as "hi-IN". */
export const langFor = (locale: string | undefined): Lang => (locale?.toLowerCase().startsWith("hi") ? "hi" : "en");

const SAMPLES: Record<Lang, Record<string, string>> = { en: { ...copy.coach.samples }, hi: { ...copy.coach.samples, ...(hi.coach?.samples as Record<string, string> | undefined) } };
/** The line a coach says when picked in Settings, in `lang` whatever the app language is (the API and voice:build use it). */
export const coachSample = (coach: string, lang: Lang): string | undefined => SAMPLES[lang][coach];
