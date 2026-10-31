"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveOnboarding } from "@/lib/profile-actions";
import { useSettings } from "@/core/store/settings.store";
import { usePlan } from "@/core/store/plan.store";
import { DEFAULT_COACH_CHARACTER } from "@/features/coaching/characters";
import { pulseTrack } from "@/lib/pulse";
import { resolveAvatar } from "@/components/ui/iconMaps";
import { useMidnightSurface } from "@/features/premium-ui/useMidnightSurface";

type GoalId = "learn-scratch" | "get-tactics" | "play-fun";
type LevelId = "none" | "pieces" | "club";

const GOALS: { id: GoalId; title: string; sub: string; icon: string }[] = [
  {
    id: "learn-scratch",
    title: "Learn from scratch",
    sub: "Start with the board and the pieces",
    icon: "M12 5v16 M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 004 2 5 5 0 014-2z",
  },
  {
    id: "get-tactics",
    title: "Get better at tactics",
    sub: "Forks, pins and winning material",
    icon: "M12 12m-10 0a10 10 0 1 0 20 0a10 10 0 1 0-20 0 M12 12m-6 0a6 6 0 1 0 12 0a6 6 0 1 0-12 0 M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0",
  },
  {
    id: "play-fun",
    title: "Play for fun",
    sub: "Friendly games with a coach",
    icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 3.128a4 4 0 0 1 0 7.744 M22 21v-2a4 4 0 0 0-3-3.87 M9 7a4 4 0 1 0 0 8",
  },
];

const LEVELS: { id: LevelId; title: string; sub: string; elo: number }[] = [
  { id: "none", title: "I know nothing", sub: "Perfect. We start at square one", elo: 600 },
  { id: "pieces", title: "I know how the pieces move", sub: "Skip the basics", elo: 900 },
  { id: "club", title: "I already play", sub: "Start with tactics", elo: 1400 },
];

function StepDots({ step }: { step: number }) {
  return (
    <div className="dots" role="img" aria-label={`Step ${step + 1} of 4`}>
      {[0, 1, 2, 3].map((i) => (
        <i key={i} className={i === step ? "on" : i < step ? "d" : ""} />
      ))}
    </div>
  );
}

function OttoCoach({
  bubble,
  mood = "neutral",
  size = "lg",
}: {
  bubble: string;
  mood?: "neutral" | "thinking";
  size?: "lg" | "md";
}) {
  const still =
    mood === "thinking"
      ? "/kit/accents/otto/thinking.webp"
      : "/kit/accents/otto/neutral.webp";
  return (
    <div className="cs-coach">
      <span className={`cs-avatar cs-avatar--${size} t-otto m-${mood}`} data-coach="otto">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={still} alt="Otto" />
      </span>
      <div className="cs-bubble cs-bubble--strong">{bubble}</div>
    </div>
  );
}

function OptionList<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { id: T; title: string; sub: string; icon?: string }[];
  value: T;
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <div className="cs-list" data-single role="radiogroup" aria-label={label}>
      {options.map((opt) => {
        const selected = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            className="cs-option"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.id)}
          >
            {opt.icon && (
              <span className="k">
                <svg className="cs-ic" viewBox="0 0 24 24" aria-hidden="true">
                  <path d={opt.icon} />
                </svg>
              </span>
            )}
            <span className="ot">
              {opt.title}
              <small>{opt.sub}</small>
            </span>
            <span className="rd">
              <svg className="cs-ic sm" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function PlacementPreview({ onSkip }: { onSkip: () => void }) {
  return (
    <>
      <div className="lh" data-center="lh">
        <div className="cs-lessonhead">
          <span className="cs-iconbtn" aria-hidden="true">
            <svg className="cs-ic" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18 6 6 18 M6 6l12 12" />
            </svg>
          </span>
          <div
            className="cs-progress"
            role="progressbar"
            aria-label="Lesson progress"
            aria-valuenow={40}
            aria-valuemin={0}
            aria-valuemax={100}
            style={{ ["--v" as string]: "40%" }}
          >
            <i />
          </div>
        </div>
      </div>
      <div className="lgrid" data-center="lgrid">
        <div className="lcoach">
          <div className="ttl">
            <span className="cs-tag">Placement · question 2 of 5</span>
            <h2 className="cs-h3">Can you spot the checkmate?</h2>
          </div>
          <OttoCoach
            mood="thinking"
            bubble="Look at what the rook can reach. Find the move that ends the game."
          />
        </div>
        <div className="lbd">
          <div className="cs-board-wrap">
            <div
              className="cs-board"
              role="img"
              aria-label="Chess board placement puzzle"
            >
              {/* Static FEN layout from design mock */}
              {Array.from({ length: 64 }).map((_, i) => (
                <div key={i} className={`cs-sq ${(Math.floor(i / 8) + (i % 8)) % 2 ? "d" : "l"}`} />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="barwrap obfoot">
        <div className="cs-actionbar">
          <div className="btns">
            <button type="button" className="cs-btn cs-btn--ghost" onClick={onSkip}>
              Skip this one
            </button>
            <Link href="/placement" className="cs-btn">
              Take full test
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

export function PremiumOnboardingWizard({ name }: { name: string }) {
  const theme = useMidnightSurface();
  const router = useRouter();
  const setSetting = useSettings((s) => s.set);
  const setTier = usePlan((s) => s.setTier);
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<GoalId>("learn-scratch");
  const [level, setLevel] = useState<LevelId>("none");
  const [busy, setBusy] = useState(false);

  const levelElo = LEVELS.find((l) => l.id === level)?.elo ?? 600;

  async function finish() {
    if (busy) return;
    setBusy(true);
    const coach = DEFAULT_COACH_CHARACTER;
    setSetting("coachCharacter", coach);
    setSetting("targetElo", levelElo);
    setTier("standard");
    const avatar = resolveAvatar("");
    await saveOnboarding({
      goal,
      avatar,
      coach,
      targetElo: levelElo,
      theme: "default",
      planTier: "standard",
    });
    pulseTrack("onboarding_complete", {
      goal,
      target_elo: levelElo,
      plan_tier: "standard",
      platform: "web",
      ui: "premium",
    });
    router.push("/welcome?next=/notify");
  }

  if (step === 3) {
    return (
      <section className="screen on" data-screen="ob-test" data-theme={theme}>
        <PlacementPreview onSkip={() => void finish()} />
      </section>
    );
  }

  if (step === 2) {
    return (
      <section className="screen on" data-screen="ob-coach" data-theme={theme}>
        <div className="ob two" data-center="ob" data-coach-picker="hidden">
          <div className="l">
            <StepDots step={2} />
            <h1 className="cs-h2" style={{ marginTop: ".5rem" }}>
              Meet your coach
            </h1>
            <p className="sub">Otto guides your first lessons. You can switch later in Settings.</p>
          </div>
          <div className="r">
            <div className="cstage glow t-otto m-neutral" data-coach="otto">
              <div className="cs-bubble cs-bubble--down cs-bubble--strong">
                Hi, I&apos;m Otto! We&apos;ll take it one small step at a time.
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="big"
                src="/kit/accents/otto/happy.webp"
                alt="Otto, your coach"
              />
            </div>
            <div className="picks" aria-hidden="true">
              <div className="pick sel">
                <span className="cs-avatar cs-avatar--md cs-avatar--ring t-otto">
                  <img src="/kit/accents/otto/neutral.webp" alt="" />
                </span>
                <span>Otto</span>
              </div>
            </div>
            <div className="role">
              <b>Otto</b>
              <span className="cs-tag">Patient &amp; encouraging</span>
            </div>
            <button type="button" className="cs-btn cs-btn--block" onClick={() => setStep(3)}>
              Continue with Otto
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="screen on"
      data-screen={step === 0 ? "ob-goal" : "ob-level"}
      data-theme={theme}
    >
      <div className="ob" data-center="ob">
        <StepDots step={step} />
        <OttoCoach
          bubble={
            step === 0
              ? `Hi, I'm Otto! What would you like from chess?`
              : "No wrong answer. I'll fit the lessons to you."
          }
        />
        <h1 className="cs-h2">{step === 0 ? "What brings you here?" : "How much chess do you know?"}</h1>
        {step === 0 ? (
          <OptionList options={GOALS} value={goal} onChange={setGoal} label="Your goal" />
        ) : (
          <>
            <OptionList options={LEVELS} value={level} onChange={setLevel} label="Your level" />
            <button
              type="button"
              className="cs-btn cs-btn--ghost cs-btn--block"
              onClick={() => setStep(3)}
            >
              Test out instead
            </button>
          </>
        )}
        <div className="grow" />
        <button
          type="button"
          className="cs-btn cs-btn--block"
          onClick={() => setStep(step === 0 ? 1 : 2)}
        >
          Continue
        </button>
      </div>
    </section>
  );
}
