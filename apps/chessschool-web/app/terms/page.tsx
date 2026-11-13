import type { Metadata } from "next";
import { copy, PRIVACY_URL } from "@chessschool/design";
import { TopBar } from "@/components/ui";

export const metadata: Metadata = { title: copy.terms.title };

export default function TermsPage() {
  return (
    <div className="flow flow-doc">
      <TopBar title={copy.terms.title} />
      <article className="doc">
        {copy.terms.body.map((p) => (
          <p key={p}>{p}</p>
        ))}
        <p>
          <a className="link" href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">
            {copy.settings.privacy}
          </a>
        </p>
      </article>
    </div>
  );
}
