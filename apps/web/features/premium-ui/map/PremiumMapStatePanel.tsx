"use client";

import Link from "next/link";
import type { Catalog } from "@/features/school/structure";
import { KitIcon } from "@/components/ui/KitIcon";
import { KitRouteLoader } from "@/components/motion/KitRouteLoader";
import type { CoursePath } from "@/features/premium-ui/pathStates";
import type { PremiumMapState } from "./mapState";

export function PremiumMapStatePanel({
  state,
  catalog,
  due,
  path,
}: {
  state: PremiumMapState;
  catalog: Catalog;
  due: number;
  path?: CoursePath | null;
}) {
  if (state === "loading") {
    return (
      <div className="state" data-testid="map-state-loading">
        <KitRouteLoader label="Loading your course map…" />
      </div>
    );
  }

  if (state === "offline") {
    return (
      <div className="content" data-center="content" data-testid="map-state-offline">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="ill ill-sm" src="/kit/illustrations/offline.webp" alt="" aria-hidden />
        <div className="banner" role="status">
          <span>
            You&apos;re offline. Saved lessons still work, and your progress syncs later.
          </span>
        </div>
        <div className="cs-list">
          <div className="over">Ready offline</div>
          <div className="cs-row cur-row">
            <div className="cs-row__tile">↓</div>
            <div className="cs-row__body">
              <b>Cached lessons</b>
              <span>Ready offline</span>
            </div>
          </div>
          <div className="cs-row">
            <div className="cs-row__body">
              <b>Daily review</b>
              <span>{due} cards ready offline</span>
            </div>
          </div>
          <div className="over" style={{ marginTop: ".5rem" }}>
            Needs internet
          </div>
          <div className="cs-row">
            <div className="cs-row__tile tile-lock">📡</div>
            <div className="cs-row__body">
              <b>Live course map</b>
              <span>Needs internet</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="state" data-testid="map-state-error">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="ill" src="/kit/illustrations/error.webp" alt="" aria-hidden />
        <h2 className="cs-h2">Couldn&apos;t load your map</h2>
        <p className="muted">Check your connection and try again.</p>
        <button type="button" className="cs-btn cs-btn--soft" onClick={() => window.location.reload()}>
          Try again
        </button>
      </div>
    );
  }

  if (state === "empty") {
    return (
      <div className="state" data-testid="map-state-empty">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="ill" src="/kit/illustrations/empty.webp" alt="" aria-hidden />
        <h2 className="cs-h2">Your path starts here</h2>
        <p className="muted">
          Pick your first class, or take a short placement and we&apos;ll choose one for you.
        </p>
        <Link href="/register" className="cs-btn cs-btn--block">
          Pick my first class
        </Link>
        <Link href="/placement" className="cs-btn cs-btn--soft cs-btn--block">
          Take the placement
        </Link>
      </div>
    );
  }

  const course = path ?? null;
  const title = course?.title ?? catalog.allClasses[0]?.title ?? "Your class";

  return (
    <div data-testid="map-state-normal">
      <div className="cs-card cs-card--feature">
        <div className="cs-unit">
          <div>
            <div className="cs-overline">{course?.overline ?? "Stage 1"}</div>
            <h1 className="cs-h3" style={{ color: "inherit" }}>
              {title}
            </h1>
          </div>
          <div
            className="cs-ring cs-ring--md"
            style={{ ["--p" as string]: String(course?.ringPercent ?? 0) }}
            role="img"
            aria-label={course ? `${course.done} of ${course.total} classes done` : "Progress"}
          >
            <b>
              {course ? `${course.done}/${course.total}` : "0/0"}
            </b>
          </div>
        </div>
      </div>
      <div className="map2">
        <div className="mapcol">
          <div className="cs-map" data-testid="course-path">
            {(course?.nodes ?? []).map((node, index) => (
              <div key={node.id}>
                {index > 0 ? <PathTrail fromLeft={course!.nodes[index - 1]?.side === "l"} /> : null}
                <div className={`cs-node cs-node--${node.kind} cs-node--${node.side}`}>
                  {node.href ? (
                    <Link href={node.href} className="cs-node__dot" aria-label={`${node.title}, ${node.caption}`}>
                      <KitIcon name={node.glyph} className="cs-ic lg" fill={node.filled} />
                      {node.kind === "current" ? <span className="cs-node__start">START</span> : null}
                    </Link>
                  ) : (
                    <button type="button" className="cs-node__dot" aria-label={`${node.title}, ${node.caption}`} disabled>
                      <KitIcon name={node.glyph} className="cs-ic lg" fill={node.filled} />
                    </button>
                  )}
                  <div className="cs-node__label">
                    <b>{node.title}</b>
                    <span>{node.caption}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rail">
          <div className="cs-row revcard">
            <div className="cs-row__tile">
              <KitIcon name="refresh-cw" className="cs-ic" />
            </div>
            <div className="cs-row__body">
              <b>Review · {due} due</b>
              <span>10 steps or fewer</span>
            </div>
            <Link href="/review" className="cs-btn cs-btn--soft cs-btn--sm">
              Start
            </Link>
          </div>
          <Link href="/gym" className="cs-row">
            <div className="cs-row__tile">
              <KitIcon name="dumbbell" className="cs-ic" />
            </div>
            <div className="cs-row__body">
              <b>Gym</b>
              <span>Drills and puzzle practice</span>
            </div>
            <KitIcon name="chevron-right" className="cs-ic" />
          </Link>
          <div className="cs-coach">
            <span className="cs-avatar cs-avatar--md t-otto m-neutral">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/kit/accents/otto/neutral.webp" alt="Otto" />
            </span>
            <div className="cs-bubble">{course?.coachLine ?? "Your path is ready when you are."}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PathTrail({ fromLeft }: { fromLeft: boolean }) {
  const d = fromLeft ? "M62 2 C62 26 138 14 138 38" : "M138 2 C138 26 62 14 62 38";
  return (
    <svg className="cs-trail" viewBox="0 0 200 40" preserveAspectRatio="none" fill="none" aria-hidden="true" style={{ height: "2.5rem", margin: ".25rem 0" }}>
      <path d={d} stroke="currentColor" strokeWidth={7} strokeLinecap="round" strokeDasharray="1 13" />
    </svg>
  );
}
