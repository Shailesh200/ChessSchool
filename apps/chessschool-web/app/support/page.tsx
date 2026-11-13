import type { Metadata } from "next";
import Link from "next/link";
import { TopBar } from "@/components/ui";

export const metadata: Metadata = {
  title: "Support",
  description: "Get help with ChessSchool accounts, progress sync, and play.",
};

const CONTACT = "support@chess-school.in";

export default function SupportPage() {
  return (
    <div className="flow flow-doc">
      <TopBar title="Support" />
      <article className="doc">
        <p className="doc-meta">
          We are a small team — email us and we will help when we can.
        </p>
        <section>
          <h2>Contact</h2>
          <p>
            Email{" "}
            <a href={`mailto:${CONTACT}`} className="link">
              {CONTACT}
            </a>
            . For security reports, use the same address with subject{" "}
            <strong>[security]</strong>.
          </p>
        </section>

        <section>
          <h2>Quick answers</h2>
          <ul className="doc-list">
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
              <Link href="/privacy" className="link">
                Privacy Policy
              </Link>
              .
            </li>
          </ul>
        </section>

        <section>
          <h2>Policies</h2>
          <p>
            <Link href="/privacy" className="link">
              Privacy
            </Link>
            {" · "}
            <Link href="/terms" className="link">
              Terms
            </Link>
          </p>
        </section>
      </article>
    </div>
  );
}
