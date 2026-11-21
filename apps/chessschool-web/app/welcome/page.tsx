"use client";

import { copy } from "@chessschool/design";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Cody } from "@/components/Lottie";
import { CoachPicker } from "@/components/CoachPicker";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui";
import { useApp } from "@/lib/state";
import { track as pulse } from "@/lib/analytics";

/** After the first lesson: coach, then the account offer (guests only). The language is chosen on the start page. */
export default function Welcome() {
  const { state, setPrefs, setSeenWelcome, cue } = useApp();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const w = copy.welcome.steps;
  const steps = state.account ? 2 : 3;

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const finish = (to: "/today" | "/signup", skipped = false) => {
    pulse(skipped ? "onboarding_skip" : "onboarding_step", { step, done: true, to: to.slice(1) });
    setSeenWelcome();
    if (to === "/today") cue("success");
    router.push(to);
  };
  const next = () => {
    cue("tap");
    if (step + 1 >= steps) finish("/today");
    else (setStep(step + 1), pulse("onboarding_step", { step: step + 1 }));
  };

  return (
    <div className="flow">
      <header className="flow-top">
        {step > 1 ? (
          <button className="icon-btn" onClick={() => setStep(step - 1)} aria-label={copy.welcome.back}>
            <Icon name="back" />
          </button>
        ) : (
          <span className="icon-btn-spacer" />
        )}
        <div className="steps" role="progressbar" aria-valuemin={1} aria-valuemax={steps - 1} aria-valuenow={step} aria-label={copy.orientation.progress(step, steps - 1)}>
          {Array.from({ length: steps - 1 }, (_, i) => (
            <span key={i} className={i < step ? "on" : ""} />
          ))}
        </div>
        <button className="link-btn" onClick={() => finish("/today", true)}>
          {copy.welcome.skip}
        </button>
      </header>

      <div className="flow-body" key={step}>
        {step === 1 ? (
          <>
            <h1 ref={headingRef} tabIndex={-1}>
              {w.coach.title}
            </h1>
            <p className="lead">{w.coach.body}</p>
            <CoachPicker value={state.prefs.coach} onChange={(id) => (setPrefs({ coach: id }), cue("tap"))} />
          </>
        ) : null}
        {step === 2 ? (
          <>
            <Cody animation="celebrate" size={170} label={copy.a11y.mascot} />
            <h1 ref={headingRef} tabIndex={-1}>
              {w.start.title}
            </h1>
            <p className="lead">{w.start.body}</p>
          </>
        ) : null}
      </div>

      <footer className="flow-actions">
        {step < 2 ? (
          <Button block onClick={next}>
            {copy.welcome.next}
          </Button>
        ) : (
          <>
            <Button block icon="shield" onClick={() => finish("/signup")}>
              {w.start.account}
            </Button>
            <Button block variant="ghost" onClick={() => finish("/today")}>
              {w.start.guest}
            </Button>
          </>
        )}
      </footer>
    </div>
  );
}
