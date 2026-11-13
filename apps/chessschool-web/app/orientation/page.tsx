"use client";

import { copy, PATH, type CodyAnimation } from "@chessschool/design";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Cody, Fx } from "@/components/Lottie";
import { Button } from "@/components/ui";
import { useApp } from "@/lib/state";

const POSES: CodyAnimation[] = ["wave", "thinking", "proud"];
const BEAT_ICONS = ["learn", "sparkles", "profile"] as const;

export default function Orientation() {
  const { state, completeOrientation, cue } = useApp();
  const router = useRouter();
  const [beat, setBeat] = useState(0);
  const [done, setDone] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const beats = copy.orientation.beats;

  useEffect(() => {
    headingRef.current?.focus();
  }, [beat, done]);

  const advance = () => {
    if (beat < beats.length - 1) {
      cue("tap");
      setBeat(beat + 1);
      return;
    }
    completeOrientation();
    cue("level-up");
    setDone(true);
  };

  return (
    <div className="flow flow-orient">
      <header className="flow-top">
        <button className="icon-btn" onClick={() => router.push("/today")} aria-label={copy.orientation.close}>
          <Icon name="close" />
        </button>
        <div className="steps" role="progressbar" aria-valuemin={0} aria-valuemax={beats.length} aria-valuenow={done ? beats.length : beat} aria-label={copy.orientation.progress(Math.min(beat + 1, beats.length), beats.length)}>
          {beats.map((_, i) => (
            <span key={i} className={done || i <= beat ? "on" : ""} />
          ))}
        </div>
        <span className="icon-btn-spacer" />
      </header>

      {done ? (
        <div className="flow-body done" key="done">
          <div className="seal">
            <Fx name="stamp" size={180} className="seal-stamp" />
            <Cody animation="celebrate" size={150} className="seal-cody" label={copy.a11y.mascot} />
          </div>
          <div className="xp-pill" role="img" aria-label={copy.a11y.xp(PATH[0].xp)}>
            <Fx name="xp-pop" size={40} />
            <span aria-hidden>{copy.orientation.xp(PATH[0].xp)}</span>
          </div>
          <h1 ref={headingRef} tabIndex={-1}>
            {copy.orientation.doneTitle}
          </h1>
          <p className="lead">{copy.orientation.doneBody}</p>
        </div>
      ) : (
        <div className="flow-body" key={beat}>
          <Cody animation={POSES[beat]} size={180} label={copy.a11y.mascot} />
          <p className="beat-tag">
            <Icon name={BEAT_ICONS[beat]} size={18} />
            {copy.orientation.progress(beat + 1, beats.length)}
          </p>
          <h1 ref={headingRef} tabIndex={-1}>
            {beats[beat].title}
          </h1>
          <p className="lead">{beats[beat].body}</p>
        </div>
      )}

      <footer className="flow-actions">
        {done ? (
          <>
            <Button block onClick={() => router.push("/today")}>
              {copy.orientation.back}
            </Button>
            {!state.account ? (
              <Button block variant="ghost" href="/signup">
                {copy.orientation.save}
              </Button>
            ) : null}
          </>
        ) : (
          <Button block onClick={advance}>
            {beat < beats.length - 1 ? copy.orientation.next : copy.orientation.finish}
          </Button>
        )}
      </footer>
    </div>
  );
}
