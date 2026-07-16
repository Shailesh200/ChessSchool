import Link from "next/link";
import { BackButton } from "@/components/ui/BackButton";

export const metadata = {
  title: "Terms of Use",
  description: "Terms for using the ChessSchool web app and related services.",
};

const CONTACT = "iamshailesh121@gmail.com";
const UPDATED = "July 17, 2026";

export default function TermsPage() {
  return (
    <div className="bg-surface min-h-dvh px-5 py-8">
      <div className="mx-auto max-w-2xl">
        <BackButton />
        <h1 className="text-ink mt-4 text-3xl font-extrabold">Terms of Use</h1>
        <p className="text-ink-500 mt-2 text-sm font-semibold">
          Last updated: {UPDATED}
        </p>

        <article className="prose-policy text-ink-700 mt-8 space-y-6 text-sm leading-relaxed font-medium">
          <section>
            <h2 className="text-ink text-lg font-extrabold">Agreement</h2>
            <p>
              By using ChessSchool (the website at chess-school.in and related apps),
              you agree to these Terms. If you do not agree, do not use the service.
              ChessSchool is operated by Shailesh Jha.
            </p>
          </section>

          <section>
            <h2 className="text-ink text-lg font-extrabold">The service</h2>
            <p>
              ChessSchool provides a free chess-learning academy: curriculum, lessons,
              practice, and play features. We may change, suspend, or discontinue
              features at any time. We do not guarantee uninterrupted availability.
            </p>
          </section>

          <section>
            <h2 className="text-ink text-lg font-extrabold">Accounts</h2>
            <p>
              You are responsible for keeping your login credentials secure and for
              activity under your account. You must provide accurate information when
              registering. You may delete your account at any time (see our{" "}
              <Link href="/privacy" className="text-brand-500 font-bold underline">
                Privacy Policy
              </Link>
              ).
            </p>
          </section>

          <section>
            <h2 className="text-ink text-lg font-extrabold">Acceptable use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Abuse, harass, or cheat other players in online games</li>
              <li>Attempt to break into accounts, APIs, or infrastructure</li>
              <li>
                Scrape or redistribute curriculum content at scale without permission
              </li>
              <li>Use the service for unlawful purposes</li>
            </ul>
            <p className="mt-3">
              We may suspend or terminate accounts that violate these terms.
            </p>
          </section>

          <section>
            <h2 className="text-ink text-lg font-extrabold">Intellectual property</h2>
            <p>
              ChessSchool branding, original UI, coach content, and curated curriculum
              structure are owned by the operator. Third-party chess engines, piece sets
              with attribution, and imported puzzle data remain subject to their own
              licenses.
            </p>
          </section>

          <section>
            <h2 className="text-ink text-lg font-extrabold">Disclaimer</h2>
            <p>
              The service is provided “as is” without warranties of any kind. Chess
              instruction and ratings are educational tools, not professional coaching
              advice. To the fullest extent permitted by law, we are not liable for
              indirect or consequential damages arising from use of ChessSchool.
            </p>
          </section>

          <section>
            <h2 className="text-ink text-lg font-extrabold">Privacy</h2>
            <p>
              How we handle personal data is described in the{" "}
              <Link href="/privacy" className="text-brand-500 font-bold underline">
                Privacy Policy
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-ink text-lg font-extrabold">Contact</h2>
            <p>
              Questions about these terms:{" "}
              <a
                href={`mailto:${CONTACT}`}
                className="text-brand-500 font-bold underline"
              >
                {CONTACT}
              </a>
              {" · "}
              <Link href="/support" className="text-brand-500 font-bold underline">
                Support
              </Link>
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
