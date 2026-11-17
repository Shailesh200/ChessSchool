"use client";

import { agreeTerms, copy, PRIVACY_URL, startRoute } from "@chessschool/design";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Cody } from "@/components/Lottie";
import { Button } from "@/components/ui";
import { useApp } from "@/lib/state";

/** Once per browser, before anything else: the terms in short. Agreeing covers the AI features, so nothing asks again later. */
function Start() {
  const { state, update, cue } = useApp();
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
