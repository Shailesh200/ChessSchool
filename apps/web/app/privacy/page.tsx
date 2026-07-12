import Link from "next/link";
import { BackButton } from "@/components/ui/BackButton";

export const metadata = {
  title: "Privacy Policy",
  description: "How ChessSchool collects, uses, and deletes your data.",
};

const CONTACT = "iamshailesh121@gmail.com";
const UPDATED = "July 12, 2026";

export default function PrivacyPage() {
  return (
    <div className="bg-surface min-h-dvh px-5 py-8">
      <div className="mx-auto max-w-2xl">
        <BackButton />
        <h1 className="text-ink mt-4 text-3xl font-extrabold">Privacy Policy</h1>
        <p className="text-ink-500 mt-2 text-sm font-semibold">
          Last updated: {UPDATED}
        </p>

        <article className="prose-policy text-ink-700 mt-8 space-y-6 text-sm leading-relaxed font-medium">
          <section>
            <h2 className="text-ink text-lg font-extrabold">Overview</h2>
            <p>
              ChessSchool (&quot;we&quot;, &quot;us&quot;) is a chess-learning app and
              website operated by Shailesh Jha. This policy explains what information we
              collect when you use our web app or mobile app, how we use it, and your
              choices — including how to delete your account.
            </p>
          </section>

          <section>
            <h2 className="text-ink text-lg font-extrabold">Information we collect</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Account data:</strong> name, email address, and a hashed password
                when you register with email. Google sign-in accounts may have no password
                stored.
              </li>
              <li>
                <strong>Google sign-in:</strong> if you use &quot;Continue with Google&quot;,
                we receive your Google account ID, email, and display name from Google to
                create or link your ChessSchool account. We do not receive your Google
                password.
              </li>
              <li>
                <strong>Student profile:</strong> student ID, rank, avatar choice,
                onboarding preferences (goal, house), and enrollment date.
              </li>
              <li>
                <strong>Gameplay progress:</strong> XP, streak, graduated classes, lesson
                mastery, homework, ratings, achievements, mistake log, activity history,
                and related settings synced to your account.
              </li>
              <li>
                <strong>Guest mode:</strong> if you use the app without an account,
                progress stays on your device only and is not sent to our servers until
                you enroll.
              </li>
              <li>
                <strong>Online play:</strong> when you create or join a shared game, move
                data and game state are stored temporarily on our servers so both players
                can sync.
              </li>
              <li>
                <strong>Coach voice (TTS):</strong> lesson and play coach lines you hear
                may be synthesized by sending the spoken text to Microsoft Edge Read Aloud
                (default) or, when configured, Google Cloud Text-to-Speech. Only the text
                to be spoken is sent — not your full profile.
              </li>
              <li>
                <strong>Usage analytics (optional):</strong> when enabled in Settings, we
                collect first-party product events (e.g. lesson completed, sign-in) and
                performance metrics (Core Web Vitals such as LCP and INP) tied to page
                paths. Signed-in users may have a user ID attached; guests send anonymous
                events only. We also load{" "}
                <a
                  href="https://vercel.com/docs/analytics"
                  className="text-brand-500 font-bold underline"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Vercel Analytics
                </a>{" "}
                and{" "}
                <a
                  href="https://vercel.com/docs/speed-insights"
                  className="text-brand-500 font-bold underline"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Vercel Speed Insights
                </a>{" "}
                on the website for aggregate traffic and performance. You can turn off
                first-party analytics and performance sharing in Settings; we honour Do
                Not Track in the browser when set.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-ink text-lg font-extrabold">
              How we use your information
            </h2>
            <p>We use your data solely to provide and improve ChessSchool:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Authenticate you and sync progress across web and mobile</li>
              <li>
                Track curriculum completion, exams, homework, and review schedules
              </li>
              <li>Enable online pass-and-play and share-code multiplayer</li>
              <li>Maintain your student profile and settings</li>
              <li>Measure site performance and product usage when you opt in</li>
            </ul>
            <p className="mt-3">
              We do not sell your personal information. We do not use your data for
              advertising or cross-app tracking.
            </p>
          </section>

          <section>
            <h2 className="text-ink text-lg font-extrabold">Where data is stored</h2>
            <p>
              Account and progress data are stored in a SQLite-compatible database hosted
              via{" "}
              <a
                href="https://turso.tech"
                className="text-brand-500 font-bold underline"
                rel="noopener noreferrer"
                target="_blank"
              >
                Turso
              </a>{" "}
              and served through{" "}
              <a
                href="https://vercel.com"
                className="text-brand-500 font-bold underline"
                rel="noopener noreferrer"
                target="_blank"
              >
                Vercel
              </a>
              . Connections use HTTPS encryption in transit.
            </p>
            <p className="mt-3">
              Optional realtime updates for online games may use{" "}
              <a
                href="https://ably.com"
                className="text-brand-500 font-bold underline"
                rel="noopener noreferrer"
                target="_blank"
              >
                Ably
              </a>{" "}
              when configured. No personal profile data is sent to Ably beyond what is
              needed to deliver game moves.
            </p>
            <p className="mt-3">
              Google sign-in is processed by{" "}
              <a
                href="https://policies.google.com/privacy"
                className="text-brand-500 font-bold underline"
                rel="noopener noreferrer"
                target="_blank"
              >
                Google
              </a>{" "}
              under their privacy policy when you choose that option.
            </p>
          </section>

          <section>
            <h2 className="text-ink text-lg font-extrabold">
              Data retention &amp; deletion
            </h2>
            <p>
              We retain your account data while your account is active. You can delete
              your account at any time from the Account screen in the mobile app or web
              app. Deletion permanently removes your profile, progress, lesson records,
              OAuth links, sessions, and any analytics or performance samples tied to your
              user ID from our servers. This action cannot be undone.
            </p>
            <p className="mt-3">
              Temporary online game records may remain for a short period without your
              account identifier. Aggregate, anonymous analytics from Vercel may persist
              according to Vercel&apos;s retention policies and cannot be tied back to you
              after account deletion.
            </p>
            <p className="mt-3">
              To request deletion by email, contact us at{" "}
              <a
                href={`mailto:${CONTACT}`}
                className="text-brand-500 font-bold underline"
              >
                {CONTACT}
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-ink text-lg font-extrabold">Children&apos;s privacy</h2>
            <p>
              ChessSchool is designed for learners of all ages but is not directed at
              children under 13 without parental involvement. We do not knowingly collect
              personal information from children under 13 without verifiable parental
              consent. If you believe a child has provided us personal data, contact us
              and we will delete it.
            </p>
          </section>

          <section>
            <h2 className="text-ink text-lg font-extrabold">Your rights</h2>
            <p>
              Depending on your location, you may have rights to access, correct, or delete
              your personal data. Account deletion in the app fulfills deletion requests.
              You can disable first-party analytics and performance sharing in Settings at
              any time. For other requests, email{" "}
              <a
                href={`mailto:${CONTACT}`}
                className="text-brand-500 font-bold underline"
              >
                {CONTACT}
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-ink text-lg font-extrabold">Changes</h2>
            <p>
              We may update this policy from time to time. The &quot;Last updated&quot;
              date at the top will change when we do. Continued use of ChessSchool after
              changes means you accept the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-ink text-lg font-extrabold">Contact</h2>
            <p>
              Questions about this policy:{" "}
              <a
                href={`mailto:${CONTACT}`}
                className="text-brand-500 font-bold underline"
              >
                {CONTACT}
              </a>
            </p>
          </section>
        </article>

        <p className="text-ink-500 mt-10 text-center text-sm font-bold">
          <Link href="/" className="text-brand-500 hover:underline">
            ← Back to ChessSchool
          </Link>
        </p>
      </div>
    </div>
  );
}
