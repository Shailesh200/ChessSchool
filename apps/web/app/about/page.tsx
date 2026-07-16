import Link from "next/link";
import { BackButton } from "@/components/ui/BackButton";

export const metadata = {
  title: "About ChessSchool",
  description:
    "ChessSchool is a free, school-structured chess academy — classes, lessons, exams, and play in the browser.",
};

export default function AboutPage() {
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
