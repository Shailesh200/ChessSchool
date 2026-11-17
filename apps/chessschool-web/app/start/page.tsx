"use client";

import { agreeTerms, copy, LANG_NAMES, LANGS, language, PRIVACY_URL, startRoute } from "@chessschool/design";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Cody } from "@/components/Lottie";
import { Button } from "@/components/ui";
import { useApp } from "@/lib/state";

/** Once per browser, before anything else: the app language, then the terms in short. Agreeing covers the AI features. */
function Start() {
  const { state, update, setPrefs, cue } = useApp();
  const router = useRouter();
  const next = useSearchParams().get("next");
  const s = copy.start;
  const agree = () => {
    const at = new Date().toISOString();
    update((st) => agreeTerms(st, at));
    cue("success");
    // Only same-site paths: `next` comes from the URL.
    router.replace(next?.startsWith("/") && !next.startsWith("//") ? next : startRoute(agreeTerms(state, at)));
  };
  return (
    <div className="flow">
      <div className="flow-body">
        <Cody animation="wave" size={130} label={copy.a11y.mascot} />
        <div className="choices start-langs" role="radiogroup" aria-label={copy.welcome.steps.lang.title}>
          {LANGS.map((l) => (
            <button key={l} type="button" role="radio" aria-checked={language() === l} className="choice" onClick={() => (setPrefs({ lang: l }), cue("tap"))}>
              <span>
                <strong>{LANG_NAMES[l]}</strong>
              </span>
            </button>
          ))}
        </div>
        <h1>{s.title}</h1>
        <ul className="start-points">
          {s.points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <p className="muted small">{s.note}</p>
      </div>
      <footer className="flow-actions">
        <Button block onClick={agree}>
          {s.agree}
        </Button>
        <p className="start-links">
          <Link href="/terms">{copy.terms.title}</Link> · <a href={PRIVACY_URL}>{copy.settings.privacy}</a>
        </p>
      </footer>
    </div>
  );
}

export default function StartPage() {
  return (
    <Suspense>
      <Start />
    </Suspense>
  );
}
