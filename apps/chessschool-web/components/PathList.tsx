"use client";

import { copy, PATH, pathStates, UNITS, type Progress } from "@chessschool/design";
import Link from "next/link";
import { Icon } from "./Icon";

const TINTS = ["brand", "accent", "gold", "success"] as const;

export function PathList({ progress }: { progress: Progress }) {
  const states = pathStates(progress);
  return (
    <div className="units">
      {UNITS.map((unit) => {
        const nodes = PATH.map((n, i) => ({ n, i, st: states[i].state })).filter((x) => x.n.unit === unit);
        const done = nodes.filter((x) => x.st === "done").length;
        return (
          <section key={unit} className="unit" aria-labelledby={`${unit}-h`}>
            <header className="unit-head">
              <h3 id={`${unit}-h`}>{copy.units[unit].title}</h3>
              <span className="unit-count">
                {done}/{nodes.length}
              </span>
            </header>
            <ol className="path" aria-label={copy.units[unit].title}>
              {nodes.map(({ n, i, st }) => {
                const c = copy.path[n.id];
                const placed = progress.placed.includes(n.id);
                const body = (
                  <>
                    <span className={`path-num tint-${TINTS[i % TINTS.length]}`} aria-hidden>
                      {st === "done" ? <Icon name="check" size={20} /> : st === "locked" ? <Icon name="lock" size={18} /> : i}
                    </span>
                    <span className="path-text">
                      <span className="path-title">{c.title}</span>
                      <span className="path-sub">{st === "locked" ? c.reason : st === "done" ? (placed ? copy.placement.skipped : copy.today.done) : copy.today.open(n.minutes)}</span>
                    </span>
                    {st === "locked" ? null : <Icon name="chevron" className="path-chevron" />}
                  </>
                );
                return (
                  <li key={n.id} className={`path-row path-${st}`}>
                    {st === "locked" ? (
                      <div className="path-inner" aria-label={copy.a11y.locked(c.title, c.reason)}>
                        {body}
                      </div>
                    ) : (
                      <Link href={n.id === "meet" ? "/orientation" : `/lesson/${n.id}`} className="path-inner" aria-label={st === "done" ? copy.a11y.done(c.title) : undefined}>
                        {body}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
