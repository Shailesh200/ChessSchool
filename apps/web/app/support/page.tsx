import Link from "next/link";
import { BackButton } from "@/components/ui/BackButton";

export const metadata = {
  title: "Support",
  description: "Get help with ChessSchool accounts, progress sync, and play.",
};

const CONTACT = "iamshailesh121@gmail.com";

export default function SupportPage() {
  return (
    <div className="bg-surface min-h-dvh px-5 py-8">
      <div className="mx-auto max-w-2xl">
        <BackButton />
        <h1 className="text-ink mt-4 text-3xl font-extrabold">Support</h1>
        <p className="text-ink-500 mt-2 text-sm font-semibold">
          We are a small team — email us and we will help when we can.
        </p>

        <article className="prose-policy text-ink-700 mt-8 space-y-6 text-sm leading-relaxed font-medium">
          <section>
            <h2 className="text-ink text-lg font-extrabold">Contact</h2>
            <p>
              Email{" "}
              <a
                href={`mailto:${CONTACT}`}
                className="text-brand-500 font-bold underline"
              >
                {CONTACT}
              </a>
              . For security reports, use the same address with subject{" "}
              <strong>[security]</strong>.
            </p>
          </section>

          <section>
            <h2 className="text-ink text-lg font-extrabold">Quick answers</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>FAQ:</strong> product questions on the{" "}
                <Link href="/#faq" className="text-brand-500 font-bold underline">
                  home FAQ
                </Link>
                .
              </li>
              <li>
                <strong>Progress not syncing:</strong> sign in with the same account you
                used before. Guest progress merges when you enroll.
              </li>
              <li>
                <strong>Google-only account:</strong> if you signed up with Google, use
                Continue with Google — there may be no password login.
              </li>
              <li>
                <strong>Delete account:</strong> use the Account screen in the app, or
                email us. Details in our{" "}
                <Link href="/privacy" className="text-brand-500 font-bold underline">
                  Privacy Policy
                </Link>
                .
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-ink text-lg font-extrabold">Policies</h2>
            <p>
              <Link href="/privacy" className="text-brand-500 font-bold underline">
                Privacy
              </Link>
              {" · "}
              <Link href="/terms" className="text-brand-500 font-bold underline">
                Terms
              </Link>
              {" · "}
              <Link href="/about" className="text-brand-500 font-bold underline">
                About
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
