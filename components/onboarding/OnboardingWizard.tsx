"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Confetti } from "@/components/ui/Confetti";
import { useSettings } from "@/core/store/settings.store";
import { usePlan } from "@/core/store/plan.store";
import { saveOnboarding } from "@/lib/profile-actions";
import { audio } from "@/core/audio/audioEngine";
import { haptics } from "@/core/haptics/haptics";

type Opt = { value: string; label: string; emoji: string };

const GOALS: Opt[] = [
  { value: "beat-friends", label: "Beat my friends", emoji: "🤝" },
  { value: "reach-1000", label: "Reach 1000 rating", emoji: "📈" },
  { value: "reach-1500", label: "Reach 1500 rating", emoji: "🚀" },
  { value: "openings", label: "Master openings", emoji: "📖" },
  { value: "tournament", label: "Tournament prep", emoji: "🏆" },
];
const EXPERIENCE: Opt[] = [
  { value: "600", label: "Brand new", emoji: "🌱" },
  { value: "900", label: "I know the rules", emoji: "🙂" },
  { value: "1400", label: "Club player", emoji: "♟️" },
  { value: "1900", label: "Strong player", emoji: "🔥" },
];
const TIME: Opt[] = [
  { value: "casual", label: "10–15 min/day", emoji: "🌱" },
  { value: "standard", label: "20–30 min/day", emoji: "📘" },
  { value: "serious", label: "45–60 min/day", emoji: "🔥" },
  { value: "competitive", label: "90+ min/day", emoji: "🏆" },
];
const COACH: Opt[] = [
  { value: "friendly", label: "Friendly teacher", emoji: "😊" },
  { value: "strict", label: "Strict grandmaster", emoji: "🎩" },
  { value: "mentor", label: "Mentor", emoji: "🧑‍🏫" },
  { value: "tactical", label: "Tactical", emoji: "⚔️" },
];
const THEME: Opt[] = [
  { value: "default", label: "Classic", emoji: "🎓" },
  { value: "blue", label: "School Blue", emoji: "💙" },
  { value: "forest", label: "Forest", emoji: "🌲" },
  { value: "midnight", label: "Midnight", emoji: "🌙" },
];
const AVATARS = ["🦊", "🦁", "🐼", "🦉", "🐯", "🐺", "🐲", "🦄", "♞", "♛", "🎓", "🐴"];

export function OnboardingWizard({ name }: { name: string }) {
  const router = useRouter();
  const setSetting = useSettings((s) => s.set);
  const setTier = usePlan((s) => s.setTier);

  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState("");
  const [elo, setElo] = useState("");
  const [time, setTime] = useState("");
  const [coach, setCoach] = useState("");
  const [theme, setTheme] = useState("");
  const [avatar, setAvatar] = useState("");
  const [finishing, setFinishing] = useState(false);

  const steps = [
    { title: `Welcome, ${name.split(" ")[0]}!`, sub: "Let's tailor your studies. What's your main goal?", opts: GOALS, value: goal, set: setGoal },
    { title: "How experienced are you?", sub: "We'll set your starting bot strength.", opts: EXPERIENCE, value: elo, set: setElo },
    { title: "How much time per day?", sub: "This sets your study plan.", opts: TIME, value: time, set: setTime },
    { title: "Pick your coach", sub: "Choose the tone you like.", opts: COACH, value: coach, set: setCoach },
    { title: "Choose a theme", sub: "You can change it anytime.", opts: THEME, value: theme, set: setTheme },
  ];
  const isAvatarStep = step === steps.length;
  const total = steps.length + 1;
  const current = steps[step];
  const canNext = isAvatarStep ? !!avatar : !!current?.value;

  async function finish() {
    setFinishing(true);
    setSetting("targetElo", Number(elo) || 800);
    setSetting("coachPersonality", coach as never);
    setSetting("appTheme", theme || "default");
    setTier((time || "standard") as never);
    audio.play("graduation");
    haptics.fire("success");
    await saveOnboarding({ goal, avatar });
    // Through the loader so the account's progress is pulled before the UI shows.
    window.setTimeout(() => router.push("/welcome?next=/account"), 1700);
  }

  if (finishing) {
    return (
      <div className="relative flex min-h-dvh flex-col items-center justify-center gap-4 overflow-hidden bg-surface px-6 text-center">
        <Confetti count={44} />
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 280, damping: 16 }} className="text-7xl">
          {avatar || "🎓"}
        </motion.div>
        <div className="rounded-pill bg-gold/20 px-4 py-1 text-xs font-extrabold uppercase tracking-wide text-warning">
          🎓 Enrolled
        </div>
        <h1 className="text-3xl font-extrabold text-ink">Welcome to ChessSchool, {name.split(" ")[0]}!</h1>
        <p className="text-sm font-semibold text-ink-500">Issuing your Student ID…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-surface px-6 py-8">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="mb-6 flex items-center justify-between">
          <Logo />
          <span className="text-xs font-bold text-ink-500">{step + 1}/{total}</span>
        </div>
        <ProgressBar value={step + 1} max={total} tone="brand" className="mb-6" />

        <AnimatePresence mode="wait">
          <motion.div
            key={isAvatarStep ? "avatar" : step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.2 }}
            className="flex flex-1 flex-col"
          >
            <h1 className="text-2xl font-extrabold text-ink">
              {isAvatarStep ? "Pick your avatar" : current!.title}
            </h1>
            <p className="mb-5 text-sm font-semibold text-ink-500">
              {isAvatarStep ? "It appears on your Student ID." : current!.sub}
            </p>

            {isAvatarStep ? (
              <div className="grid grid-cols-4 gap-3">
                {AVATARS.map((a) => (
                  <button
                    key={a}
                    onClick={() => { setAvatar(a); haptics.fire("select"); }}
                    className={`btn-tactile flex aspect-square items-center justify-center rounded-card border-2 text-3xl ${
                      avatar === a ? "border-brand bg-brand-50" : "border-hairline bg-surface-card"
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {current!.opts.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => { current!.set(o.value); haptics.fire("select"); audio.play("select"); }}
                    className={`btn-tactile flex items-center gap-3 rounded-card border-2 p-3 text-left ${
                      current!.value === o.value ? "border-brand bg-brand-50" : "border-hairline bg-surface-card"
                    }`}
                  >
                    <span className="text-2xl">{o.emoji}</span>
                    <span className="text-sm font-extrabold text-ink">{o.label}</span>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-6 flex gap-2">
          {step > 0 && (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>Back</Button>
          )}
          <Button
            block
            disabled={!canNext}
            onClick={() => (isAvatarStep ? finish() : setStep((s) => s + 1))}
          >
            {isAvatarStep ? "Enroll 🎓" : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
