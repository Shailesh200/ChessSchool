"use client";

import { copy } from "@chessschool/design";
import { useEffect, useRef } from "react";
import { useApp } from "@/lib/state";
import { Icon } from "./Icon";
import { Cody, Fx } from "./Lottie";

/** "Your progress is saved" — plays once on Today after sign-up or log-in. */
export function SavedCeremony() {
  const { state, clearCeremony, cue } = useApp();
  const on = state.pendingCeremony === "saved";
  const played = useRef(false);

  useEffect(() => {
    if (!on || played.current) return;
    played.current = true;
    cue("stamp");
    const t = setTimeout(clearCeremony, 4200);
    return () => clearTimeout(t);
  }, [on, cue, clearCeremony]);

  if (!on) return null;
  return (
    <div className="ceremony" role="status" aria-live="polite">
      <div className="ceremony-art" aria-hidden>
        <Fx name="stamp" size={84} />
        <Cody animation="celebrate" size={88} />
      </div>
      <div>
        <p className="ceremony-title">{copy.ceremony.saved}</p>
        <p className="ceremony-body">{copy.ceremony.savedBody}</p>
      </div>
      <button className="icon-btn icon-btn-sm" onClick={clearCeremony} aria-label={copy.a11y.dismiss}>
        <Icon name="close" />
      </button>
    </div>
  );
}

/** "You came back" — first open of a new day after earlier practice. */
export function ArrivalCeremony({ streak }: { streak: number }) {
  const { state, clearArrival, cue } = useApp();
  const kind = state.arrival;
  const played = useRef(false);

  useEffect(() => {
    if (!kind || played.current) return;
    played.current = true;
    cue(kind === "kept" ? "success" : "tap");
  }, [kind, cue]);

  if (!kind || state.pendingCeremony === "saved") return null;
  const kept = kind === "kept";
  return (
    <div className="arrival" role="status">
      <div className="arrival-art" aria-hidden>
        {kept ? <Fx name="streak-spark" size={84} /> : null}
        <Cody animation="wave" size={84} />
      </div>
      <div>
        <h2>{kept ? copy.today.arrival.keptTitle : copy.today.arrival.freshTitle}</h2>
        <p>{kept ? copy.today.arrival.keptBody(streak) : copy.today.arrival.freshBody}</p>
      </div>
      <button className="icon-btn" onClick={clearArrival} aria-label={copy.a11y.dismiss}>
        <Icon name="close" />
      </button>
    </div>
  );
}
