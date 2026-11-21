import { copy, setLanguage, visibleStreak, type Lang, type Progress } from "@chessschool/design";
import { APP_URL, layout } from "./lifecycle";

/** One parent's Sunday summary. Built from saved progress; nothing about other learners. */
export type Summary = { name: string; lessons: number; puzzles: number; streak: number; next: string | null };
export type Sender = {
  email: (to: string, subject: string, html: string, text: string, headers?: Record<string, string>) => Promise<boolean>;
  push: (token: string, title: string, body: string) => Promise<boolean>;
};

/** Resend's free plan allows 100 emails a day; one run never sends more than this. */
export const EMAIL_RUN_CAP = 90;

export function summarize(name: string, p: Progress, lastPuzzles: number, today: string, nextUnit: string | null): Summary {
  const weekAgo = new Date(new Date(`${today}T12:00:00Z`).getTime() - 6 * 86_400_000).toISOString().slice(0, 10);
  const placed = new Set(p.placed);
  const lessons = Object.entries(p.completed).filter(([id, day]) => !placed.has(id) && day >= weekAgo && day <= today).length;
  return { name, lessons, puzzles: Math.max(0, p.puzzles.solved - lastPuzzles), streak: visibleStreak(p.streak, today), next: nextUnit };
}

/** The weekly summary in `lang`, in the same branded layout as the lifecycle emails. */
export function summaryMessage(s: Summary, lang: string, unsubscribeUrl?: string | null) {
  const l: Lang = lang === "hi" ? "hi" : "en";
  setLanguage(l);
  let t;
  try {
    const w = copy.platform.weekly;
    t = {
      subject: w.subject(s.name),
      lines: [w.lessons(s.lessons), w.puzzles(s.puzzles), s.streak ? w.streak(s.streak) : w.noStreak, s.next ? w.next(s.next) : w.allDone],
      push: w.push(s.lessons, s.puzzles, s.streak),
      footer: w.footer,
      cta: copy.platform.email.weeklyCta,
      unsubscribe: copy.platform.email.unsubscribe,
    };
  } finally {
    setLanguage("en");
  }
  const m = layout({ lang: l, subject: t.subject, heading: t.subject, lines: t.lines, cta: t.cta, why: t.footer, unsubscribeUrl: unsubscribeUrl ?? APP_URL, unsubscribeLabel: t.unsubscribe });
  return { subject: t.subject, html: m.html, text: m.text, push: t.push, headers: unsubscribeUrl ? m.headers : {} };
}

/** Resend email + Expo push, from env. Missing keys mean that channel is skipped. */
export function senderFromEnv(env: NodeJS.ProcessEnv): Sender {
  return {
    async email(to, subject, html, text, headers) {
      if (!env.RESEND_API_KEY) return false;
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: "ChessSchool <hello@chess-school.in>", reply_to: "support@chess-school.in", to: [to], subject, html, text, ...(headers && Object.keys(headers).length ? { headers } : {}) }),
        // One slow send must not use up the whole cron run.
        signal: AbortSignal.timeout(10_000),
      });
      return res.ok;
    },
    async push(token, title, body) {
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ to: token, title, body, sound: "default" }),
        signal: AbortSignal.timeout(10_000),
      });
      return res.ok;
    },
  };
}
