"use client";

import { copy, rankedSkills, weakSkills, type Skills } from "@chessschool/design";
import { Button, Card } from "@/components/ui";

/** Profile "Skills": strongest and weakest ideas, and what to practise next. */
export function SkillsCard({ skills }: { skills: Skills | undefined }) {
  const t = copy.skills;
  const ranked = rankedSkills(skills);
  const next = weakSkills(skills)[0];
  const strong = [...ranked].reverse().slice(0, 2);
  const weak = ranked.filter((x) => !strong.includes(x)).slice(0, 2);
  const list = (items: typeof ranked) => (
    <ul className="skills-list">
      {items.map((x) => (
        <li key={x.id} aria-label={t.score(t.names[x.id], x.s)}>
          <span>{t.names[x.id]}</span>
          <div className="skill-bar" aria-hidden="true">
            <span className={x.s >= 70 ? "strong" : x.s < 45 ? "weak" : undefined} style={{ width: `${x.s}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
  return (
    <Card className="skills-card">
      <h2>{t.title}</h2>
      {!ranked.length ? (
        <p className="muted">{t.empty}</p>
      ) : (
        <>
          <p className="muted small">{t.strongest}</p>
          {list(strong)}
          {weak.length ? (
            <>
              <p className="muted small">{t.weakest}</p>
              {list(weak)}
            </>
          ) : null}
          {next ? (
            <>
              <p>
                <strong>{t.next(t.names[next])}</strong>
              </p>
              <Button variant="secondary" icon="practice" href="/practice">
                {t.practise}
              </Button>
            </>
          ) : null}
        </>
      )}
    </Card>
  );
}
