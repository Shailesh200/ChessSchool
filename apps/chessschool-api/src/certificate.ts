import { copy, MASCOT_SVG_INNER, palettes, setLanguage, type Lang } from "@chessschool/design";
import { createHmac, timingSafeEqual } from "node:crypto";

/** Used only when CERT_SECRET is unset outside production (local dev and tests). */
export const DEV_CERT_SECRET = "chessschool-dev-cert-secret";
export const CERT_LINK_DAYS = 7;

/** Escapes text placed into the SVG (the learner's name is user input). */
export const xml = (v: string) => v.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

const sign = (secret: string, userId: string, unitId: string, exp: number) => createHmac("sha256", secret).update(`${userId}:${unitId}:${exp}`).digest("base64url");

/** A share token for one learner's certificate of one unit: `<userId>.<expiry ms>.<hmac>`. */
export function certToken(secret: string, userId: string, unitId: string, now: number): string {
  const exp = now + CERT_LINK_DAYS * 86_400_000;
  return `${userId}.${exp}.${sign(secret, userId, unitId, exp)}`;
}

/** The learner id when the token is genuine, for this unit, and not expired; otherwise null. */
export function readCertToken(secret: string, token: string, unitId: string, now: number): string | null {
  const [userId, expRaw, sig, extra] = token.split(".");
  const exp = Number(expRaw);
  if (!userId || !sig || extra !== undefined || !Number.isSafeInteger(exp) || exp <= now) return null;
  const want = Buffer.from(sign(secret, userId, unitId, exp));
  const got = Buffer.from(sig);
  return got.length === want.length && timingSafeEqual(got, want) ? userId : null;
}

/** Certificate words in `lang`. setLanguage is synchronous, so nothing else can see the switch. */
function words(lang: Lang) {
  setLanguage(lang);
  const t = { ...copy.certificate };
  setLanguage("en");
  return t;
}

const formatDay = (day: string, lang: Lang) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Intl.DateTimeFormat(lang === "hi" ? "hi-IN" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(Date.UTC(y, m - 1, d));
};

/** Shrinks long lines so they stay inside the frame. */
const fit = (text: string, max: number, width: number) => Math.min(max, Math.floor(width / Math.max(1, text.length * 0.55)));

/** A4 landscape, print-ready. All text is escaped here. */
export function certificateSvg(input: { name: string; unit: string; day: string; lang: Lang }): string {
  const t = words(input.lang);
  const p = palettes.light;
  const name = input.name.trim() || t.learner;
  const font = `'Fredoka', 'Baloo 2', 'Nunito', 'Arial Rounded MT Bold', 'Noto Sans Devanagari', 'Mukta', system-ui, sans-serif`;
  const serif = `'Playfair Display', Georgia, 'Times New Roman', 'Noto Serif Devanagari', serif`;
  const gold = "#EDB443";
  const goldDeep = "#A56B10";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="297mm" height="210mm" viewBox="0 0 1188 840" role="img" aria-label="${xml(`${t.title}: ${name}, ${input.unit}`)}">
  <defs>
    <radialGradient id="glow" cx="50%" cy="0%" r="70%"><stop offset="0" stop-color="#FDF1D6"/><stop offset="1" stop-color="#FFFDF7" stop-opacity="0"/></radialGradient>
    <radialGradient id="seal" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#FFE7A8"/><stop offset=".6" stop-color="${gold}"/><stop offset="1" stop-color="${goldDeep}"/></radialGradient>
  </defs>
  <rect width="1188" height="840" fill="#FFFDF7"/>
  <rect width="1188" height="420" fill="url(#glow)"/>
  <rect x="30" y="30" width="1128" height="780" rx="14" fill="none" stroke="${gold}" stroke-width="6"/>
  <rect x="50" y="50" width="1088" height="740" rx="8" fill="none" stroke="${gold}" stroke-width="1.5" opacity=".7"/>
  <svg x="524" y="70" width="140" height="140" viewBox="86 120 340 340">${MASCOT_SVG_INNER}</svg>
  <g text-anchor="middle" fill="${p.text}">
    <text x="594" y="250" font-family="${font}" font-size="22" font-weight="700" fill="${goldDeep}" letter-spacing="6">${xml(t.title.toUpperCase())}</text>
    <text x="594" y="306" font-family="${serif}" font-style="italic" font-size="28" fill="${p.textMuted}">${xml(t.presented)}</text>
    <text x="594" y="396" font-family="${serif}" font-size="${fit(name, 78, 1500)}" font-weight="700">${xml(name)}</text>
    <line x1="394" y1="428" x2="794" y2="428" stroke="${gold}" stroke-width="2"/>
    <text x="594" y="482" font-family="${font}" font-size="26" fill="${p.textMuted}">${xml(t.finished)}</text>
    <text x="594" y="548" font-family="${font}" font-size="${fit(input.unit, 46, 1400)}" font-weight="700" fill="#A8392C">${xml(input.unit)}</text>
  </g>
  <g font-family="${font}" fill="${p.text}">
    <text x="190" y="686" font-size="24" font-weight="700">${xml(formatDay(input.day, input.lang))}</text>
    <text x="190" y="716" font-size="18" fill="${p.textMuted}">${xml(t.dateLabel)}</text>
    <circle cx="594" cy="688" r="58" fill="url(#seal)"/>
    <circle cx="594" cy="688" r="46" fill="none" stroke="#FFF6E0" stroke-width="2" opacity=".8"/>
    <text x="594" y="712" text-anchor="middle" font-size="64" fill="#3A2800">♛</text>
    <text x="998" y="686" text-anchor="end" font-size="24" font-weight="700">chess-school.in</text>
    <text x="998" y="716" text-anchor="end" font-size="18" fill="${p.textMuted}">${xml(t.verify)}</text>
  </g>
</svg>
`;
}
