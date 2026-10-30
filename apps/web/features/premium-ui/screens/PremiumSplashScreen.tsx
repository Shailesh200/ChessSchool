"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { KitLottie } from "@/components/motion/KitLottie";
import { useSettings } from "@/core/store/settings.store";
import { resolvePremiumColorMode } from "@/core/themes/kitTokens";

/** 01-splash — premium illustrated entry. */
export function PremiumSplashScreen() {
  const router = useRouter();
  const appTheme = useSettings((s) => s.appTheme);
  const dark = resolvePremiumColorMode(appTheme) === "dark";
  const splashId = dark ? "logo-splash-dark" : "logo-splash-light";

  return (
    <section className="screen on" id="s-splash" data-route="splash" data-screen="splash">
      <div className="splash" data-center="splash">
        <div className="hero herop" data-hero>
          <div className="logo-lot lockup" role="img" aria-label="ChessSchool">
            <span className="markwrap">
              <span className="mglow" />
              <KitLottie id={splashId} className="h-24 w-24 max-w-[min(72vw,280px)]" />
            </span>
            <span className="wm" aria-hidden="true">
              <b>Chess</b>
              <i>School</i>
            </span>
          </div>
        </div>
        <div className="act">
          <h1 className="cs-h1 big">Learn chess with a coach who has your back.</h1>
          <p className="sub2">Short lessons, kind feedback, no pressure.</p>
          <div className="btns1">
            <Link href="/register" className="cs-btn cs-btn--accent cs-btn--block">
              Get started
            </Link>
            <button
              type="button"
              className="cs-btn cs-btn--ghost cs-btn--block"
              onClick={() => router.push("/login")}
            >
              I already have an account
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
