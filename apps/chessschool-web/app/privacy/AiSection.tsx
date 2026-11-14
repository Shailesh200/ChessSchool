"use client";

import { copy } from "@chessschool/design";

/** The AI part of the policy, in the learner's language (the rest of the page is English only). */
export function AiSection() {
  const t = copy.privacyAi;
  return (
    <section id="ai">
      <h2>{t.title}</h2>
      <p>{t.intro}</p>
      <ul className="doc-list">
        {t.items.map((item) => (
          <li key={item.label}>
            <strong>{item.label}:</strong> {item.text}
          </li>
        ))}
      </ul>
    </section>
  );
}
