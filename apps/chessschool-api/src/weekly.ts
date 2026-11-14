import { visibleStreak, type Progress } from "@chessschool/design";

/** One parent's Sunday summary. Built from saved progress; nothing about other learners. */
export type Summary = { name: string; lessons: number; puzzles: number; streak: number; next: string | null };
export type Sender = {
  email: (to: string, subject: string, html: string, text: string) => Promise<boolean>;
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

const T = {
  en: {
    subject: (s: Summary) => `${s.name || "Your learner"}'s week on ChessSchool`,
    lines: (s: Summary) => [
      `${s.lessons} ${s.lessons === 1 ? "lesson" : "lessons"} finished`,
      `${s.puzzles} ${s.puzzles === 1 ? "puzzle" : "puzzles"} solved`,
      s.streak ? `${s.streak}-day streak` : "No streak right now. One short lesson starts a new one.",
      s.next ? `Next up: ${s.next}` : "Every unit so far is finished. Practice and puzzles keep it fresh.",
    ],
    push: (s: Summary) => `${s.lessons} lessons, ${s.puzzles} puzzles this week${s.streak ? `, ${s.streak}-day streak` : ""}.`,
    footer: "You get this because the weekly summary is on in ChessSchool Settings. Turn it off there any time.",
  },
  hi: {
    subject: (s: Summary) => `ChessSchool पर ${s.name || "आपके बच्चे"} का हफ़्ता`,
    lines: (s: Summary) => [
      `${s.lessons} पाठ पूरे`,
      `${s.puzzles} पहेलियाँ हल`,
      s.streak ? `${s.streak} दिन की स्ट्रीक` : "अभी कोई स्ट्रीक नहीं। एक छोटा पाठ नई शुरुआत करता है।",
      s.next ? `अगला: ${s.next}` : "अब तक की हर यूनिट पूरी। अभ्यास और पहेलियाँ इसे ताज़ा रखती हैं।",
    ],
    push: (s: Summary) => `इस हफ़्ते ${s.lessons} पाठ, ${s.puzzles} पहेलियाँ${s.streak ? `, ${s.streak} दिन की स्ट्रीक` : ""}।`,
    footer: "आपको यह इसलिए मिला क्योंकि ChessSchool सेटिंग्स में साप्ताहिक सारांश चालू है। वहीं कभी भी बंद करें।",
  },
};

const esc = (v: string) => v.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

export function summaryMessage(s: Summary, lang: string) {
  const t = lang === "hi" ? T.hi : T.en;
  const lines = t.lines(s);
  const text = `${lines.join("\n")}\n\n${t.footer}`;
  const html = `<div style="font-family:system-ui,sans-serif;color:#1C1B2E;max-width:480px">
<h2 style="color:#4B46C4;margin:0 0 12px">${esc(t.subject(s))}</h2>
<ul style="padding-left:20px;line-height:1.7">${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
<p style="color:#5E5C78;font-size:13px">${esc(t.footer)}</p></div>`;
  return { subject: t.subject(s), html, text, push: t.push(s) };
}

/** Resend email + Expo push, from env. Missing keys mean that channel is skipped. */
export function senderFromEnv(env: NodeJS.ProcessEnv): Sender {
  return {
    async email(to, subject, html, text) {
      if (!env.RESEND_API_KEY) return false;
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: "ChessSchool <hello@chess-school.in>", reply_to: "support@chess-school.in", to: [to], subject, html, text }),
      });
      return res.ok;
    },
    async push(token, title, body) {
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ to: token, title, body, sound: "default" }),
      });
      return res.ok;
    },
  };
}
