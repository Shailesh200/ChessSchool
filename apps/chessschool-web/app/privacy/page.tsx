import type { Metadata } from "next";
import Link from "next/link";
import { TopBar } from "@/components/ui";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How ChessSchool collects, uses, and deletes your data.",
};

const CONTACT = "support@chess-school.in";
const UPDATED = "November 14, 2026";

export default function PrivacyPage() {
  return (
    <div className="flow flow-doc">
      <TopBar title="Privacy Policy" />
      <article className="doc">
        <p className="doc-meta">Last updated: {UPDATED}</p>
        <section>
          <h2>Overview</h2>
          <p>
            ChessSchool (&quot;we&quot;, &quot;us&quot;) is a chess-learning app and
            website operated by Shailesh Jha. This policy explains what information we
            collect when you use our web app or mobile app, how we use it, and your
            choices — including how to delete your account.
          </p>
        </section>

        <section>
          <h2>Information we collect</h2>
          <ul className="doc-list">
            <li>
              <strong>Account data:</strong> name, email address, and a hashed password
              when you register with email. Google sign-in accounts may have no password
              stored.
            </li>
            <li>
              <strong>Google sign-in:</strong> if you use &quot;Continue with
              Google&quot;, we receive your Google account ID, email, and display name
              from Google to create or link your ChessSchool account. We do not receive
              your Google password.
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
              <strong>Coach voice:</strong> lesson lines are recorded ahead of time from the
              lesson text with ElevenLabs and played from our file storage (Vercel Blob).
              Nothing you type or say is sent to make them.
            </li>
            <li>
              <strong>Anonymous usage:</strong> the app and website send a few events
              (app opened, lesson started, finished or left with the step number, puzzle
              solved or failed, game or practice finished) with a random install ID, the
              platform and the app version. They never include your name, email, account
              or guest ID. This is on by default and you can turn it off at any time in
              Settings → &quot;Share anonymous usage&quot;; events are deleted after 180 days.
            </li>
            <li>
              <strong>Classes:</strong> when you join a class, its members see your
              display name, avatar, join date, number of lessons finished, streak and
              rank. You can report or block a classmate; reports (reason, an optional
              note and who reported whom) are read only by the ChessSchool team. The
              class monitor can remove members.
            </li>
            <li>
              <strong>Error monitoring:</strong> we send crash and error reports to{" "}
              <a
                href="https://sentry.io/privacy/"
                className="link"
                rel="noopener noreferrer"
                target="_blank"
              >
                Sentry
              </a>{" "}
              so we can fix bugs. Reports may include stack traces, page URLs, and
              browser/device metadata. We do not enable session replay and we do not
              send default personally identifiable information with these reports.
            </li>
          </ul>
        </section>

        <section>
          <h2>How we use your information</h2>
          <p>We use your data solely to provide and improve ChessSchool:</p>
          <ul className="doc-list">
            <li>Authenticate you and sync progress across web and mobile</li>
            <li>Track curriculum completion, exams, homework, and review schedules</li>
            <li>Enable online pass-and-play and share-code multiplayer</li>
            <li>Maintain your student profile and settings</li>
            <li>See which lessons are too hard, from anonymous usage (unless you turn it off)</li>
          </ul>
          <p>
            We do not sell your personal information. We do not use your data for
            advertising or cross-app tracking.
          </p>
        </section>

        <section>
          <h2>Where data is stored</h2>
          <p>
            Account and progress data are stored in a SQLite-compatible database hosted
            via{" "}
            <a
              href="https://turso.tech"
              className="link"
              rel="noopener noreferrer"
              target="_blank"
            >
              Turso
            </a>{" "}
            and served through{" "}
            <a
              href="https://vercel.com"
              className="link"
              rel="noopener noreferrer"
              target="_blank"
            >
              Vercel
            </a>
            . Connections use HTTPS encryption in transit.
          </p>
          <p>
            Optional realtime updates for online games may use{" "}
            <a
              href="https://ably.com"
              className="link"
              rel="noopener noreferrer"
              target="_blank"
            >
              Ably
            </a>{" "}
            when configured. No personal profile data is sent to Ably beyond what is
            needed to deliver game moves.
          </p>
          <p>
            Google sign-in is processed by{" "}
            <a
              href="https://policies.google.com/privacy"
              className="link"
              rel="noopener noreferrer"
              target="_blank"
            >
              Google
            </a>{" "}
            under their privacy policy when you choose that option.
          </p>
        </section>

        <section>
          <h2>Data retention &amp; deletion</h2>
          <p>
            We retain your account data while your account is active. You can delete
            your account at any time from the Account screen in the mobile app or web
            app. Deletion permanently removes your profile, progress, lesson records,
            OAuth links, sessions, class memberships, and reports and blocks you made or
            received from our servers. This action cannot be undone. Anonymous usage
            events are not tied to your account and are deleted after 180 days.
          </p>
          <p>
            Temporary online game records may remain for a short period without your
            account identifier.
          </p>
          <p>
            To request deletion by email, contact us at{" "}
            <a href={`mailto:${CONTACT}`} className="link">
              {CONTACT}
            </a>
            .
          </p>
        </section>

        <section>
          <h2>Children&apos;s privacy</h2>
          <p>
            ChessSchool is designed for learners of all ages but is not directed at
            children under 13 without parental involvement. We do not knowingly collect
            personal information from children under 13 without verifiable parental
            consent. If you believe a child has provided us personal data, contact us
            and we will delete it.
          </p>
        </section>

        <section>
          <h2>Your rights</h2>
          <p>
            Depending on your location, you may have rights to access, correct, or
            delete your personal data. Account deletion in the app fulfills deletion
            requests. You can turn off anonymous usage sharing in Settings at any
            time. For other requests, email{" "}
            <a href={`mailto:${CONTACT}`} className="link">
              {CONTACT}
            </a>
            .
          </p>
        </section>

        <section>
          <h2>Changes</h2>
          <p>
            We may update this policy from time to time. The &quot;Last updated&quot;
            date at the top will change when we do. Continued use of ChessSchool after
            changes means you accept the updated policy.
          </p>
        </section>

        <section>
          <h2>Contact</h2>
          <p>
            Questions about this policy:{" "}
            <a href={`mailto:${CONTACT}`} className="link">
              {CONTACT}
            </a>
            . For general help see{" "}
            <Link href="/support" className="link">
              Support
            </Link>
            . Related:{" "}
            <Link href="/terms" className="link">
              Terms of Use
            </Link>
            .
          </p>
        </section>
      </article>
    </div>
  );
}
