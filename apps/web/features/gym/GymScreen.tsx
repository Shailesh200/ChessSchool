"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useProgression } from "@/core/store/progression.store";
import { KitIcon } from "@/components/ui/KitIcon";
import { MiniBoard } from "@/features/gym/MiniBoard";
import { DAILY_PUZZLE, GYM_PUZZLES, type GymPuzzle } from "./puzzles";

const SKILLS = ["All", "Forks", "Pins", "Skewers", "Mates", "Endgames"] as const;
const LEVELS = ["All", "Easy", "Medium", "Hard"] as const;

export function GymScreen({ fixture = false }: { fixture?: boolean }) {
  const lessons = useProgression((s) => s.lessons);
  const [query, setQuery] = useState("");
  const [skill, setSkill] = useState<(typeof SKILLS)[number]>("All");
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("All");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return GYM_PUZZLES.filter((p) => {
      if (skill !== "All" && p.skill !== skill) return false;
      if (level !== "All" && p.level !== level) return false;
      if (q && !p.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [query, skill, level]);

  function done(p: GymPuzzle): boolean {
    if (fixture) return p.fixtureDone;
    const record = lessons[p.lessonId];
    return Boolean(record && record.mastery >= 0.8);
  }

  return (
    <div className="illustrated">
      <div className="pagehead">
        <h1>Gym</h1>
      </div>
      <p className="muted" style={{ marginTop: "-0.5rem" }}>
        Short puzzles to sharpen one skill at a time.
      </p>
      <section className="card" aria-label="Daily puzzle">
        <div className="daily">
          <div>
            <span className="over">Daily puzzle</span>
            <h2 style={{ margin: "0.2rem 0" }}>Spot the fork</h2>
            <p className="muted" style={{ marginBottom: "0.8rem" }}>
              A new one every day. Takes about 2 minutes.
            </p>
            <Link className="btn coral sm" href={`/lesson/${DAILY_PUZZLE.lessonId}`}>
              Solve it
            </Link>
          </div>
          <MiniBoard fen={DAILY_PUZZLE.fen} />
        </div>
      </section>
      <div className="searchbox">
        <label htmlFor="gym-q">Search puzzles</label>
        <div className="inp">
          <KitIcon name="search" />
          <input
            id="gym-q"
            type="search"
            value={query}
            autoComplete="off"
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>
      <div className="chips" role="group" aria-label="Skill">
        {SKILLS.map((name) => (
          <button
            key={name}
            type="button"
            className="fchip"
            aria-pressed={skill === name}
            onClick={() => setSkill(name)}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="chips" role="group" aria-label="Level">
        {LEVELS.map((name) => (
          <button
            key={name}
            type="button"
            className="fchip"
            aria-pressed={level === name}
            onClick={() => setLevel(name)}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="sec">
        <h2 style={{ fontSize: "1.25rem" }}>Puzzles</h2>
        <span className="muted" aria-live="polite">
          {rows.length} shown
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="muted">No puzzles match that search.</p>
      ) : (
        <ul className="pgrid">
          {rows.map((p) => {
            const solved = done(p);
            return (
              <li key={p.id}>
                <Link className="pz" href={`/lesson/${p.lessonId}`}>
                  <MiniBoard fen={p.fen} />
                  <span className="rt">
                    <b>{p.title}</b>
                    <span>{solved ? "Solved" : "Not tried yet"}</span>
                    <span className="tags">
                      <span className="pill">{p.skill}</span>
                      <span className={`pill ${p.level.toLowerCase()}`}>{p.level}</span>
                    </span>
                  </span>
                  {solved && (
                    <span className="pill ok">
                      <KitIcon name="check" className="sm" />
                      Done
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
