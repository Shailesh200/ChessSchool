"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { copy, rankFor, RANKS, type IconName } from "@chessschool/design";
import { Icon } from "./Icon";
import { Cody } from "./Lottie";

/* ---------- Button ---------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonProps = {
  variant?: ButtonVariant;
  block?: boolean;
  icon?: IconName;
  loading?: boolean;
  href?: string;
  children: React.ReactNode;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children">;

export function Button({ variant = "primary", block, icon, loading, href, children, className = "", ...rest }: ButtonProps) {
  const cls = `btn btn-${variant}${block ? " btn-block" : ""} ${className}`;
  const inner = (
    <>
      {loading ? <span className="spinner" aria-hidden /> : icon ? <Icon name={icon} size={22} /> : null}
      <span>{loading ? copy.auth.working : children}</span>
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button className={cls} aria-busy={loading || undefined} disabled={loading || rest.disabled} {...rest}>
      {inner}
    </button>
  );
}

/* ---------- Surfaces ---------- */

export function Card({ children, className = "", as: As = "section", ...rest }: { children: React.ReactNode; className?: string; as?: "section" | "div" | "article" } & React.HTMLAttributes<HTMLElement>) {
  return (
    <As className={`card ${className}`} {...rest}>
      {children}
    </As>
  );
}

export function Chip({ icon, tone = "neutral", children, label }: { icon?: IconName; tone?: "neutral" | "brand" | "gold" | "accent" | "success"; children: React.ReactNode; label?: string }) {
  return (
    <span className={`chip chip-${tone}`} aria-label={label}>
      {icon ? <Icon name={icon} size={18} /> : null}
      <span aria-hidden={label ? true : undefined}>{children}</span>
    </span>
  );
}

/* ---------- Form controls ---------- */

export function Switch({ checked, onChange, label, hint, icon, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; icon?: IconName; disabled?: boolean }) {
  const id = useId();
  return (
    <button type="button" role="switch" aria-checked={checked} aria-describedby={hint ? `${id}-h` : undefined} className="row row-switch" onClick={() => onChange(!checked)} disabled={disabled}>
      {icon ? <Icon name={icon} /> : null}
      <span className="row-text">
        <span className="row-label">{label}</span>
        {hint ? (
          <span className="row-hint" id={`${id}-h`}>
            {hint}
          </span>
        ) : null}
      </span>
      <span className={`switch${checked ? " on" : ""}`} aria-hidden />
    </button>
  );
}

export function Segmented<T extends string | number>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const idx = options.findIndex((o) => o.value === value);
  const move = (d: number) => {
    const next = (idx + d + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o, i) => (
        <button
          key={String(o.value)}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={o.value === value ? 0 : -1}
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowDown") (e.preventDefault(), move(1));
            if (e.key === "ArrowLeft" || e.key === "ArrowUp") (e.preventDefault(), move(-1));
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

type FieldProps = {
  label: string;
  error?: string | null;
  hint?: string;
  password?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>;

export function TextField({ label, error, hint, password, id: idProp, type, ...rest }: FieldProps) {
  const auto = useId();
  const id = idProp ?? auto;
  const [show, setShow] = useState(false);
  const described = [error ? `${id}-e` : null, hint ? `${id}-h` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`field${error ? " has-error" : ""}`}>
      <label htmlFor={id}>{label}</label>
      <div className="field-box">
        <input id={id} type={password ? (show ? "text" : "password") : type} aria-invalid={error ? true : undefined} aria-describedby={described} {...rest} />
        {password ? (
          <button type="button" className="field-eye" onClick={() => setShow(!show)} aria-label={show ? copy.auth.hide : copy.auth.show} aria-pressed={show}>
            <Icon name={show ? "eyeOff" : "eye"} />
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="field-error" id={`${id}-e`} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="field-hint" id={`${id}-h`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/* ---------- Sheet (modal dialog) ---------- */

export function Sheet({ open, onClose, labelledBy, children }: { open: boolean; onClose: () => void; labelledBy: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const drag = useRef<{ y: number; id: number } | null>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.style.transform = "";
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open]);
  const move = (y: number) => {
    if (!drag.current || !ref.current) return;
    ref.current.style.transition = "none";
    ref.current.style.transform = `translateY(${Math.max(0, y - drag.current.y)}px)`;
  };
  const end = (y: number) => {
    const d = ref.current;
    if (!drag.current || !d) return;
    const dy = y - drag.current.y;
    drag.current = null;
    d.style.transition = "transform 200ms cubic-bezier(0.16, 1, 0.3, 1)";
    if (dy > 100) {
      d.style.transform = "translateY(100%)";
      setTimeout(onClose, 180);
    } else d.style.transform = "";
  };
  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={labelledBy}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div
        className="sheet-grip"
        aria-hidden
        onPointerDown={(e) => {
          drag.current = { y: e.clientY, id: e.pointerId };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => move(e.clientY)}
        onPointerUp={(e) => end(e.clientY)}
        onPointerCancel={(e) => end(e.clientY)}
      >
        <span />
      </div>
      <div className="sheet-body">{children}</div>
    </dialog>
  );
}

/* ---------- Toast ---------- */

const ToastCtx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<{ text: string; id: number } | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 3200);
    return () => clearTimeout(t);
  }, [msg]);
  const show = useCallback((text: string) => setMsg({ text, id: Date.now() }), []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {msg ? (
          <div className="toast" key={msg.id}>
            {msg.text}
          </div>
        ) : null}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- Top bar for inner pages ---------- */

/**
 * Sticky header: transparent at the top, frosted once the page scrolls.
 * With `large`, a big page title sits below it and the small title fades in when the big one scrolls away.
 */
export function TopBar({ title, back = true, backHref, action, large }: { title?: string; back?: boolean; backHref?: string; action?: React.ReactNode; large?: boolean }) {
  const router = useRouter();
  const [stuck, setStuck] = useState(false);
  const [titleOn, setTitleOn] = useState(!large);
  const big = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const on = () => setStuck(window.scrollY > 4);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => {
    if (!large || !big.current) return;
    const io = new IntersectionObserver(([e]) => setTitleOn(!e.isIntersecting), { rootMargin: "-40px 0px 0px 0px" });
    io.observe(big.current);
    return () => io.disconnect();
  }, [large]);
  return (
    <>
      <header className={`topbar${stuck ? " is-stuck" : ""}${large ? " is-large" : ""}${titleOn ? " title-on" : ""}`}>
        {back ? (
          <button
            className="icon-btn"
            aria-label={copy.welcome.back}
            onClick={() => (backHref ? router.push(backHref) : window.history.length > 1 ? router.back() : router.push("/today"))}
          >
            <Icon name="back" />
          </button>
        ) : (
          <span className="icon-btn-spacer" />
        )}
        {title ? (
          large ? (
            <span className="topbar-title" aria-hidden>
              {title}
            </span>
          ) : (
            <h1 className="topbar-title">{title}</h1>
          )
        ) : null}
        {action ?? <span className="icon-btn-spacer" />}
      </header>
      {large && title ? (
        <h1 ref={big} className="page-title">
          {title}
        </h1>
      ) : null}
    </>
  );
}

/** The page's main action, floating above the tab bar so it is always in reach. Put it last in the page. */
export function ActionDock({ children }: { children: React.ReactNode }) {
  return (
    <div className="action-dock">
      <div className="action-dock-inner">{children}</div>
    </div>
  );
}

/** One-line nudge for guests: save progress with an account. */
export function SaveBanner({ title, body }: { title: string; body?: string }) {
  return (
    <div className="save-strip">
      <Cody animation="love" size={44} />
      <div className="save-strip-text">
        <strong>{title}</strong>
        {body ? (
          <span className="muted">{body}</span>
        ) : (
          <Link href="/login" className="save-strip-link">
            {copy.you.saveCard.login}
          </Link>
        )}
      </div>
      <Link href="/signup" className="save-strip-btn" aria-label={copy.you.saveCard.cta}>
        {copy.you.saveCard.short}
      </Link>
    </div>
  );
}

/* ---------- Progress visuals ---------- */

export function GoalRing({ done, goal, size = 96 }: { done: number; goal: number; size?: number }) {
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  const frac = Math.min(1, goal ? done / goal : 0);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={copy.a11y.goalRing(Math.min(done, goal), goal)}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--cs-sunken)" strokeWidth={10} />
      <circle
        className="ring-progress"
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={frac >= 1 ? "var(--cs-success)" : "var(--cs-brand)"}
        strokeWidth={10}
        strokeLinecap="round"
        strokeDasharray={`${c * frac} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="ring-text">
        {Math.round(frac * 100)}%
      </text>
    </svg>
  );
}

// U+FE0E forces text (not emoji) presentation so the glyphs take the fill colour everywhere.
const PIECE_GLYPH: Record<string, string> = { pawn: "♟\uFE0E", knight: "♞\uFE0E", bishop: "♝\uFE0E", rook: "♜\uFE0E", queen: "♛\uFE0E", king: "♚\uFE0E" };

/** The learning curve: six ranks on a rising line, current rank lit. */
export function RankCurve({ xp }: { xp: number }) {
  const r = rankFor(xp);
  const W = 320;
  const H = 130;
  const pts = RANKS.map((_, i) => {
    const t = i / (RANKS.length - 1);
    return [28 + t * (W - 56), H - 30 - Math.pow(t, 1.35) * (H - 62)] as const;
  });
  const d = pts.map(([x, y], i) => (i === 0 ? `M${x} ${y}` : `L${x} ${y}`)).join(" ");
  return (
    <figure className="rank-curve" aria-label={copy.a11y.rank(copy.ranks[r.rank], r.toNext, r.next ? copy.ranks[r.next] : null)} role="img">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" aria-hidden>
        <path d={d} fill="none" stroke="var(--cs-line)" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
        {r.index < RANKS.length - 1 ? (
          <line
            x1={pts[r.index][0]}
            y1={pts[r.index][1]}
            x2={pts[r.index][0] + (pts[r.index + 1][0] - pts[r.index][0]) * r.fraction}
            y2={pts[r.index][1] + (pts[r.index + 1][1] - pts[r.index][1]) * r.fraction}
            stroke="var(--cs-brand)"
            strokeWidth={6}
            strokeLinecap="round"
          />
        ) : null}
        {pts.map(([x, y], i) => {
          const reached = i <= r.index;
          const current = i === r.index;
          return (
            <g key={RANKS[i].id}>
              {current ? <circle cx={x} cy={y} r={27} fill="var(--cs-brand)" opacity={0.18} className="rank-glow" /> : null}
              <circle cx={x} cy={y} r={20} fill={reached ? "var(--cs-brand)" : "var(--cs-card)"} stroke={reached ? "var(--cs-brand)" : "var(--cs-line)"} strokeWidth={3} />
              <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="central" fontSize={24} fill={reached ? "var(--cs-on-brand)" : "var(--cs-text-muted)"}>
                {PIECE_GLYPH[RANKS[i].id]}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="rank-caption">
        <strong>{copy.ranks[r.rank]}</strong>
        <span>{r.next ? copy.today.rankToNext(r.toNext, copy.ranks[r.next]) : copy.a11y.rank(copy.ranks[r.rank], 0, null)}</span>
      </figcaption>
    </figure>
  );
}
