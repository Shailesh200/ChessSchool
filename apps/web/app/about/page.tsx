import Link from "next/link";
import { BackButton } from "@/components/ui/BackButton";
import {
  STOCKFISH_AUTHORS_CREDIT,
  STOCKFISH_JS_RELEASE_URL,
  STOCKFISH_NOTICE,
  STOCKFISH_SOURCE_URL,
  STOCKFISH_TAG,
  appSourceUrl,
  webBuildRevision,
} from "@/lib/licences";

export const metadata = {
  title: "About ChessSchool",
  description:
    "ChessSchool is a free, school-structured chess academy — classes, lessons, exams, and play in the browser.",
};

export default function AboutPage() {
  const revision = webBuildRevision();
  const appSource = appSourceUrl(revision);
  return (
    <div className="bg-surface min-h-dvh px-5 py-8">
      <div className="mx-auto max-w-2xl">
        <BackButton />
        <h1 className="text-ink mt-4 text-3xl font-extrabold">About ChessSchool</h1>
        <p className="text-ink-500 mt-2 text-sm font-semibold">
          A free chess academy on the web
        </p>

        <article className="prose-policy text-ink-700 mt-8 space-y-6 text-sm leading-relaxed font-medium">
          <section>
            <h2 className="text-ink text-lg font-extrabold">What we are</h2>
            <p>
              ChessSchool is a premium, offline-capable chess-learning PWA structured
              like a school. Students graduate through Classes → Semesters → Stages with
              FEN-verified lessons, exams, homework, and matches — not a random puzzle
              feed.
            </p>
          </section>

          <section>
            <h2 className="text-ink text-lg font-extrabold">Free to learn</h2>
            <p>
              The academy is free to use in the browser. Create an account to sync
              progress across devices, or continue as a guest and enroll when you are
              ready. There is no paid tier required for the core curriculum.
            </p>
          </section>

          <section>
            <h2 className="text-ink text-lg font-extrabold">How it works</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>Campus map of schools and classes</li>
              <li>Guided lessons with a coach and interactive board</li>
              <li>Play vs bot, pass-and-play, or online with a share code</li>
              <li>Dashboard, journal, and study plan to track growth</li>
            </ul>
          </section>

          <section>
            <h2 className="text-ink text-lg font-extrabold">Who runs it</h2>
            <p>
              ChessSchool is operated by Shailesh Jha. Live at{" "}
              <a
                href="https://chess-school.in"
                className="text-brand-500 font-bold underline"
              >
                chess-school.in
              </a>
              . For help, see{" "}
              <Link href="/support" className="text-brand-500 font-bold underline">
                Support
              </Link>
              .
            </p>
          </section>

          <section id="licences">
            <h2 className="text-ink text-lg font-extrabold">Licences</h2>
            <p>{STOCKFISH_NOTICE}.</p>
            <p>
              {STOCKFISH_AUTHORS_CREDIT} ChessSchool serves Stockfish 18 (tag {STOCKFISH_TAG})
              as a lite, single-threaded WebAssembly build. The GPL-3.0 text and author
              list are published beside the engine.
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <a
                  href={STOCKFISH_SOURCE_URL}
                  className="text-brand-500 font-bold underline"
                >
                  Stockfish source
                </a>{" "}
                at {STOCKFISH_TAG}
              </li>
              <li>
                <a
                  href={STOCKFISH_JS_RELEASE_URL}
                  className="text-brand-500 font-bold underline"
                >
                  stockfish.js 18.0.0
                </a>{" "}
                (the WebAssembly files in /engine)
              </li>
              <li>
                <a href="/engine/Copying.txt" className="text-brand-500 font-bold underline">
                  GNU GPL-3.0 (Copying.txt)
                </a>
              </li>
              <li>
                <a href="/engine/AUTHORS" className="text-brand-500 font-bold underline">
                  Stockfish AUTHORS
                </a>
              </li>
              <li>
                <a href={appSource} className="text-brand-500 font-bold underline">
                  ChessSchool source
                </a>
                {revision ? ` (${revision.slice(0, 12)})` : " (repository root)"}
              </li>
            </ul>
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
