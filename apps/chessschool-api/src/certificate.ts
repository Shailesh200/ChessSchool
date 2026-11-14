import { copy, palettes, setLanguage, type Lang } from "@chessschool/design";
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
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="297mm" height="210mm" viewBox="0 0 1188 840" role="img" aria-label="${xml(`${t.title}: ${name}, ${input.unit}`)}">
  <rect width="1188" height="840" fill="${p.bg}"/>
  <rect x="36" y="36" width="1116" height="768" rx="40" fill="${p.card}" stroke="${p.brand}" stroke-width="8"/>
  <rect x="60" y="60" width="1068" height="720" rx="28" fill="none" stroke="${p.brandSoft}" stroke-width="4"/>
  <g font-family="${font}" text-anchor="middle" fill="${p.text}">
    <circle cx="594" cy="150" r="54" fill="${p.brand}"/>
    <text x="594" y="174" font-size="64" fill="${p.onBrand}">♞</text>
    <text x="594" y="262" font-size="26" font-weight="600" fill="${p.brandText}" letter-spacing="4">CHESSSCHOOL</text>
    <text x="594" y="330" font-size="52" font-weight="700">${xml(t.title)}</text>
    <text x="594" y="398" font-size="26" fill="${p.textMuted}">${xml(t.presented)}</text>
    <text x="594" y="484" font-size="${fit(name, 76, 1700)}" font-weight="700" fill="${p.brandEdge}">${xml(name)}</text>
    <line x1="344" y1="510" x2="844" y2="510" stroke="${p.accent}" stroke-width="4" stroke-linecap="round"/>
    <text x="594" y="562" font-size="26" fill="${p.textMuted}">${xml(t.finished)}</text>
    <text x="594" y="626" font-size="${fit(input.unit, 44, 1500)}" font-weight="600">${xml(input.unit)}</text>
    <text x="594" y="712" font-size="22" fill="${p.textMuted}">${xml(t.date(formatDay(input.day, input.lang)))}</text>
  </g>
</svg>
`;
}
