"use client";

import { AVATARS, copy, type AvatarId, type CodyAnimation, type DailyMinutes } from "@chessschool/design";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Cody } from "@/components/Lottie";
import { CoachPicker } from "@/components/CoachPicker";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui";
import { useApp } from "@/lib/state";

const POSES: CodyAnimation[] = ["wave", "happy", "proud", "reading", "celebrate"];
const STEPS = 5;

export default function Welcome() {
  const { state, setProfile, setPrefs, setSeenWelcome, cue } = useApp();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const w = copy.welcome.steps;

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const finish = (to: "/today" | "/login") => {
    setSeenWelcome();
    if (to === "/today") cue("success");
    router.push(to);
  };
  const next = () => {
    cue("tap");
    setStep((s) => Math.min(STEPS - 1, s + 1));
  };

  return (
    <div className="flow">
      <header className="flow-top">
        {step > 0 ? (
          <button className="icon-btn" onClick={() => setStep(step - 1)} aria-label={copy.welcome.back}>
            <Icon name="back" />
          </button>
        ) : (
          <span className="icon-btn-spacer" />
        )}
        <div className="steps" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS} aria-valuenow={step + 1} aria-label={copy.orientation.progress(step + 1, STEPS)}>
          {Array.from({ length: STEPS }, (_, i) => (
            <span key={i} className={i <= step ? "on" : ""} />
          ))}
        </div>
        <button className="link-btn" onClick={() => finish("/today")}>
          {copy.welcome.skip}
        </button>
      </header>

      <div className="flow-body" key={step}>
        {step === 1 || step === 3 ? null : <Cody animation={POSES[step]} size={step === 0 ? 200 : 150} label={copy.a11y.mascot} />}
        {step === 0 ? (
          <>
            <h1 ref={headingRef} tabIndex={-1}>
              {w.intro.title}
            </h1>
            <p className="lead">{w.intro.body}</p>
          </>
        ) : null}
        {step === 1 ? (
          <>
            <h1 ref={headingRef} tabIndex={-1}>
              {copy.you.avatar}
            </h1>
            <p className="lead">{copy.you.avatarHint}</p>
            <div className="avatar-grid" role="radiogroup" aria-label={copy.you.avatar}>
              {AVATARS.map((id) => (
                <button key={id} type="button" role="radio" aria-checked={state.profile.avatar === id} className={`avatar-pick${state.profile.avatar === id ? " is-on" : ""}`} onClick={() => (setProfile({ avatar: id as AvatarId }), cue("tap"))}>
                  {id === "cody" ? <Cody animation="idle" size={64} /> : <img src={`/coaches/${id}.png`} alt="" width={72} height={72} />}
                </button>
              ))}
            </div>
          </>
        ) : null}
        {step === 2 ? (
          <>
            <h1 ref={headingRef} tabIndex={-1}>
              {w.minutes.title}
            </h1>
            <p className="lead">{w.minutes.body}</p>
            <div className="choices" role="radiogroup" aria-label={w.minutes.title}>
              {([5, 10, 15] as DailyMinutes[]).map((m, i) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={state.profile.dailyMinutes === m}
                  className="choice"
                  onClick={() => (setProfile({ dailyMinutes: m }), cue("tap"))}
                >
                  <span>
                    <strong>{m} min</strong> · {w.minutes.options[m]}
                  </span>
                  {state.profile.dailyMinutes === m ? <Icon name="check" /> : null}
                </button>
              ))}
            </div>
          </>
        ) : null}
        {step === 3 ? (
          <>
            <h1 ref={headingRef} tabIndex={-1}>
              {w.coach.title}
            </h1>
            <p className="lead">{w.coach.body}</p>
            <CoachPicker value={state.prefs.coach} onChange={(id) => (setPrefs({ coach: id }), cue("tap"))} />
          </>
        ) : null}
        {step === 4 ? (
          <>
            <h1 ref={headingRef} tabIndex={-1}>
              {w.start.title}
            </h1>
            <p className="lead">{w.start.body}</p>
          </>
        ) : null}
      </div>

      <footer className="flow-actions">
        {step < STEPS - 1 ? (
          <Button block onClick={next} style={{ color: "var(--cs-on-brand)", background: "var(--cs-brand)", justifyContent: "center", textAlign: "center" }}>
            {copy.welcome.next}
          </Button>
        ) : (
          <>
            <Button block onClick={() => finish("/today")}>
              {w.start.guest}
            </Button>
            <Button block variant="ghost" onClick={() => finish("/login")}>
              {w.start.account}
            </Button>
          </>
        )}
      </footer>
    </div>
  );
}
