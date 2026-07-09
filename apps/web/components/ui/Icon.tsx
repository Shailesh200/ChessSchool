import type { SVGProps } from "react";
import { cn } from "./cn";

/**
 * ChessSchool icon system — original, brand-matched line icons (rounded, 2px,
 * `currentColor`, optional duotone fill). Replaces emoji in UI chrome for a
 * consistent premium look that themes automatically (light/dark/app themes).
 */

export type IconName =
  | "learn"
  | "play"
  | "review"
  | "profile"
  | "flame"
  | "cap"
  | "chart"
  | "calendar"
  | "journal"
  | "palette"
  | "flask"
  | "gear"
  | "check"
  | "lock"
  | "close"
  | "arrowRight"
  | "chevronRight"
  | "star"
  | "trophy"
  | "sparkle"
  | "bulb"
  | "share"
  | "undo"
  | "flip"
  | "plus"
  | "target"
  | "dna"
  | "compass"
  | "eye"
  | "eyeOff"
  | "chevronLeft"
  | "chevronDown"
  | "redo"
  | "skipBack"
  | "skipForward"
  | "pause"
  | "playFill"
  | "pawn"
  | "handshake"
  | "message"
  | "users"
  | "robot"
  | "crown"
  | "brain"
  | "sword"
  | "seedling"
  | "volume"
  | "volumeOff"
  | "warning"
  | "wifi"
  | "save"
  | "exam"
  | "moon"
  | "book"
  | "search"
  | "medal"
  | "gem"
  | "fork"
  | "pin"
  | "puzzle"
  | "link"
  | "rocket"
  | "plug"
  | "knight"
  | "rook"
  | "bishop"
  | "queen"
  | "map"
  | "tree"
  | "wave"
  | "celebrate"
  | "building"
  | "scroll"
  | "backpack"
  | "heart";

const S = {
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  fill: "none",
} as const;
const duo = { fill: "currentColor", opacity: 0.28 };

const ICONS: Record<IconName, (duotone: boolean) => React.ReactNode> = {
  learn: (d) => (
    <>
      {d && <path d="M4 5.5A2 2 0 0 1 6 4h5v15H6a2 2 0 0 0-2 1z" {...duo} />}
      <path
        d="M12 5c-1-1-2.5-1.5-5-1.5C5.5 3.5 4 4 4 5v13c2.5 0 4 .5 5 1.5 1-1 2.5-1.5 5-1.5V4c-1.5 0-3 0-4 1Z"
        {...S}
      />
      <path d="M12 5v14" {...S} />
    </>
  ),
  play: (d) => (
    <>
      {d && <rect x="3" y="4" width="18" height="16" rx="4" {...duo} />}
      <rect x="3" y="4" width="18" height="16" rx="4" {...S} />
      <path d="M10 9.5l5 2.5-5 2.5z" {...S} fill="currentColor" />
    </>
  ),
  review: (d) => (
    <>
      {d && <circle cx="12" cy="12" r="8" {...duo} />}
      <path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5" {...S} />
      <path d="M3 4v4h4" {...S} />
      <path d="M12 8v4l3 2" {...S} />
    </>
  ),
  profile: (d) => (
    <>
      {d && <circle cx="12" cy="9" r="4" {...duo} />}
      <circle cx="12" cy="9" r="3.5" {...S} />
      <path d="M5 20c1.2-3.6 4-5.5 7-5.5s5.8 1.9 7 5.5" {...S} />
    </>
  ),
  flame: () => (
    <path
      d="M12 3c1.8 3.5 5 4.2 5 8.5a5 5 0 0 1-10 0c0-1.8.8-2.8 1.8-3.7.4 1.8 1.7 1.8 1.7 0 0-1.8-.8-3 1.5-4.8Z"
      fill="currentColor"
    />
  ),
  cap: (d) => (
    <>
      {d && <path d="M3 9l9-4 9 4-9 4z" {...duo} />}
      <path d="M3 9l9-4 9 4-9 4-9-4Z" {...S} />
      <path d="M7 11v4c0 1.3 2.2 2.5 5 2.5s5-1.2 5-2.5v-4" {...S} />
      <path d="M21 9v4" {...S} />
    </>
  ),
  chart: (d) => (
    <>
      {d && <rect x="3" y="4" width="18" height="16" rx="3" {...duo} />}
      <rect x="3" y="4" width="18" height="16" rx="3" {...S} />
      <path d="M7.5 15v-3M12 15V9M16.5 15v-5" {...S} />
    </>
  ),
  calendar: (d) => (
    <>
      {d && <rect x="3.5" y="5" width="17" height="15" rx="3" {...duo} />}
      <rect x="3.5" y="5" width="17" height="15" rx="3" {...S} />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" {...S} />
    </>
  ),
  journal: (d) => (
    <>
      {d && <rect x="5" y="3.5" width="13" height="17" rx="2.5" {...duo} />}
      <path
        d="M7 3.5h9a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"
        {...S}
      />
      <path d="M6 16.5h12M9.5 7.5h5M9.5 11h5" {...S} />
    </>
  ),
  palette: (d) => (
    <>
      {d && (
        <path
          d="M12 3.5a8.5 8.5 0 0 0 0 17c1.4 0 2-1 2-2s-.5-1.5 0-2.5 3-.5 3.5-2A8.5 8.5 0 0 0 12 3.5Z"
          {...duo}
        />
      )}
      <path
        d="M12 3.5a8.5 8.5 0 0 0 0 17c1.4 0 2-1 2-2s-.5-1.5 0-2.5 3-.5 3.5-2A8.5 8.5 0 0 0 12 3.5Z"
        {...S}
      />
      <circle cx="8" cy="11" r="1" fill="currentColor" />
      <circle cx="12" cy="8" r="1" fill="currentColor" />
      <circle cx="16" cy="11" r="1" fill="currentColor" />
    </>
  ),
  flask: (d) => (
    <>
      {d && (
        <path
          d="M10 3.5v6l-4.5 7.5A2 2 0 0 0 7.2 20h9.6a2 2 0 0 0 1.7-3L14 9.5v-6z"
          {...duo}
        />
      )}
      <path
        d="M9.5 3.5h5M10 3.5v6l-4.5 7.5A2 2 0 0 0 7.2 20h9.6a2 2 0 0 0 1.7-3L14 9.5v-6"
        {...S}
      />
      <path d="M8 14.5h8" {...S} />
    </>
  ),
  gear: (d) => (
    <>
      {d && <circle cx="12" cy="12" r="8.5" {...duo} />}
      <circle cx="12" cy="12" r="3" {...S} />
      <path
        d="M12 2.5v2.5M12 19v2.5M21.5 12H19M5 12H2.5M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8M18.7 18.7l-1.8-1.8M7.1 7.1 5.3 5.3"
        {...S}
      />
    </>
  ),
  check: () => <path d="M5 12.5l4.5 4.5L19 7" {...S} />,
  lock: (d) => (
    <>
      {d && <rect x="5" y="10.5" width="14" height="10" rx="2.5" {...duo} />}
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" {...S} />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" {...S} />
    </>
  ),
  close: () => <path d="M6 6l12 12M18 6L6 18" {...S} />,
  arrowRight: () => <path d="M5 12h14M13 6l6 6-6 6" {...S} />,
  chevronRight: () => <path d="M9 6l6 6-6 6" {...S} />,
  star: () => (
    <path
      d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17l-5.2 2.6 1-5.8L3.5 9.7l5.9-.9z"
      fill="currentColor"
    />
  ),
  trophy: (d) => (
    <>
      {d && <path d="M7 4h10v5a5 5 0 0 1-10 0z" {...duo} />}
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" {...S} />
      <path
        d="M7 6H4.5v1A3.5 3.5 0 0 0 8 10.5M17 6h2.5v1a3.5 3.5 0 0 1-3.5 3.5M12 14v3M8.5 20h7M9.5 20c0-1.5 1-2.5 2.5-2.5s2.5 1 2.5 2.5"
        {...S}
      />
    </>
  ),
  sparkle: () => (
    <path
      d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6zM18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8z"
      fill="currentColor"
    />
  ),
  bulb: (d) => (
    <>
      {d && <circle cx="12" cy="10" r="6" {...duo} />}
      <path d="M9 16a6 6 0 1 1 6 0c-.6.5-1 1-1 2H10c0-1-.4-1.5-1-2Z" {...S} />
      <path d="M10 20h4M10.5 22h3" {...S} />
    </>
  ),
  share: () => (
    <>
      <circle cx="6" cy="12" r="2.2" {...S} />
      <circle cx="17" cy="6" r="2.2" {...S} />
      <circle cx="17" cy="18" r="2.2" {...S} />
      <path d="M8 11l7-4M8 13l7 4" {...S} />
    </>
  ),
  undo: () => <path d="M4 9h9a5 5 0 0 1 0 10h-4M4 9l4-4M4 9l4 4" {...S} />,
  flip: () => (
    <path d="M4 8a8 8 0 0 1 14-3M20 5v4h-4M20 16a8 8 0 0 1-14 3M4 19v-4h4" {...S} />
  ),
  plus: () => <path d="M12 5v14M5 12h14" {...S} />,
  target: (d) => (
    <>
      {d && <circle cx="12" cy="12" r="8.5" {...duo} />}
      <circle cx="12" cy="12" r="8.5" {...S} />
      <circle cx="12" cy="12" r="4.5" {...S} />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    </>
  ),
  dna: () => (
    <path
      d="M7 3c0 4 10 6 10 9s-10 5-10 9M17 3c0 4-10 6-10 9s10 5 10 9M8 6h8M8 18h8M9.5 9h5M9.5 15h5"
      {...S}
    />
  ),
  compass: (d) => (
    <>
      {d && <circle cx="12" cy="12" r="8.5" {...duo} />}
      <circle cx="12" cy="12" r="8.5" {...S} />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" {...S} fill="currentColor" />
    </>
  ),
  eye: () => (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" {...S} />
      <circle cx="12" cy="12" r="3" {...S} />
    </>
  ),
  eyeOff: () => (
    <>
      <path
        d="M3 3l18 18M10.5 10.5a3 3 0 0 0 4.24 4.24M9.9 5.1A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a18.2 18.2 0 0 1-4.12 5.12M6.12 6.12A18.5 18.5 0 0 0 2 12s3.5 7 10 7a10.7 10.7 0 0 0 4.9-1.2"
        {...S}
      />
    </>
  ),
  chevronLeft: () => <path d="M15 18l-6-6 6-6" {...S} />,
  chevronDown: () => <path d="M6 9l6 6 6-6" {...S} />,
  redo: () => <path d="M4 9h9a5 5 0 0 1 0 10h-4M20 9l-4-4M20 9l-4 4" {...S} />,
  skipBack: () => (
    <>
      <path d="M6 7v10" {...S} />
      <path d="M18 7v10" {...S} />
      <path d="M18 12H10l4-4M10 12l4 4" {...S} />
    </>
  ),
  skipForward: () => (
    <>
      <path d="M6 7v10" {...S} />
      <path d="M18 7v10" {...S} />
      <path d="M6 12H14l-4-4M14 12l-4 4" {...S} />
    </>
  ),
  pause: () => (
    <>
      <path d="M9 7v10" {...S} />
      <path d="M15 7v10" {...S} />
    </>
  ),
  playFill: (d) => (
    <>
      {d && <circle cx="12" cy="12" r="9" {...duo} />}
      <circle cx="12" cy="12" r="9" {...S} />
      <path d="M10 9.5l5 2.5-5 2.5z" fill="currentColor" stroke="none" />
    </>
  ),
  pawn: (d) => (
    <>
      {d && (
        <path
          d="M12 5.5c1.6 0 2.8 1.2 2.8 2.7 0 .9-.4 1.7-1 2.2 1.8 1 3 3.1 3.3 6.1H7.9c.3-3 1.5-5.1 3.3-6.1-.6-.5-1-1.3-1-2.2 0-1.5 1.2-2.7 2.8-2.7z"
          {...duo}
        />
      )}
      <path
        d="M12 5.5c1.6 0 2.8 1.2 2.8 2.7 0 .9-.4 1.7-1 2.2 1.8 1 3 3.1 3.3 6.1H7.9c.3-3 1.5-5.1 3.3-6.1-.6-.5-1-1.3-1-2.2 0-1.5 1.2-2.7 2.8-2.7z"
        {...S}
      />
      <path d="M8.5 18.5h7" {...S} />
    </>
  ),
  handshake: (d) => (
    <>
      {d && <path d="M4 12.5 8 8.5l3 3 5-5 4 4v5.5H8.5L4 15.5z" {...duo} />}
      <path d="M4 12.5 8 8.5l3 3 5-5 4 4v5.5H8.5L4 15.5z" {...S} />
    </>
  ),
  message: (d) => (
    <>
      {d && <path d="M5 6.5h14v9H9l-4 3.5V6.5z" {...duo} />}
      <path d="M5 6.5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9.5L5 18V6.5z" {...S} />
      <path d="M8.5 10h7M8.5 12.5h4.5" {...S} />
    </>
  ),
  users: (d) => (
    <>
      {d && <circle cx="9" cy="9.5" r="3" {...duo} />}
      <circle cx="9" cy="9.5" r="2.5" {...S} />
      <path d="M3.5 19c.8-2.8 2.8-4.5 5.5-4.5s4.7 1.7 5.5 4.5" {...S} />
      <circle cx="16.5" cy="10" r="2" {...S} />
      <path d="M14.5 19c.5-1.8 1.8-3 3.5-3s3 1.2 3.5 3" {...S} />
    </>
  ),
  robot: (d) => (
    <>
      {d && <rect x="6" y="7" width="12" height="11" rx="3" {...duo} />}
      <rect x="6" y="7" width="12" height="11" rx="3" {...S} />
      <path d="M12 4v3M9 4h6" {...S} />
      <circle cx="10" cy="12.5" r="1" fill="currentColor" />
      <circle cx="14" cy="12.5" r="1" fill="currentColor" />
      <path d="M10 16h4" {...S} />
    </>
  ),
  crown: (d) => (
    <>
      {d && <path d="M5 17h14l-2-9-3.5 4L12 7l-1.5 5L7 8z" {...duo} />}
      <path d="M5 17h14l-2-9-3.5 4L12 7l-1.5 5L7 8z" {...S} />
      <path d="M5 17v2h14v-2" {...S} />
    </>
  ),
  brain: (d) => (
    <>
      {d && (
        <path
          d="M9 5.5a3 3 0 0 0-2.2 5.2 3.5 3.5 0 0 0 .7 6.8H15a3.5 3.5 0 0 0 .7-6.8A3 3 0 0 0 15 5.5c-.8 0-1.5.3-2 .8-.5-.5-1.2-.8-2-.8-.8 0-1.5.3-2 .8-.5-.5-1.2-.8-2-.8z"
          {...duo}
        />
      )}
      <path
        d="M9 5.5a3 3 0 0 0-2.2 5.2 3.5 3.5 0 0 0 .7 6.8H15a3.5 3.5 0 0 0 .7-6.8A3 3 0 0 0 15 5.5c-.8 0-1.5.3-2 .8-.5-.5-1.2-.8-2-.8-.8 0-1.5.3-2 .8-.5-.5-1.2-.8-2-.8z"
        {...S}
      />
      <path d="M12 8v8M9.5 11h5M9.5 14h5" {...S} />
    </>
  ),
  sword: (d) => (
    <>
      {d && <path d="m14 4 6 6-8 8-3-3z" {...duo} />}
      <path d="m14 4 6 6-8 8-3-3z" {...S} />
      <path d="m7 17-3 3M16 6l2-2" {...S} />
    </>
  ),
  seedling: (d) => (
    <>
      {d && <path d="M12 20V10M12 10C12 6 16 4 18 4c0 4-2 6-6 6zM12 10C12 6 8 4 6 4c0 4 2 6 6 6z" {...duo} />}
      <path d="M12 20V10M12 10C12 6 16 4 18 4c0 4-2 6-6 6zM12 10C12 6 8 4 6 4c0 4 2 6 6 6z" {...S} />
    </>
  ),
  volume: (d) => (
    <>
      {d && <path d="M8 9H5v6h3l5 4V5z" {...duo} />}
      <path d="M8 9H5v6h3l5 4V5z" {...S} />
      <path d="M17 9.5a4 4 0 0 1 0 5M19.5 7a7 7 0 0 1 0 10" {...S} />
    </>
  ),
  volumeOff: () => (
    <>
      <path d="M8 9H5v6h3l5 4V5z" {...S} />
      <path d="m18 9-6 6M12 9l6 6" {...S} />
    </>
  ),
  warning: (d) => (
    <>
      {d && <path d="M12 4 3.5 19h17z" {...duo} />}
      <path d="M12 4 3.5 19h17z" {...S} />
      <path d="M12 10v4M12 17h.01" {...S} />
    </>
  ),
  wifi: (d) => (
    <>
      {d && <circle cx="12" cy="18" r="1.2" fill="currentColor" />}
      <path d="M8.5 14.5a6 6 0 0 1 7 0M5.5 11.5a10 10 0 0 1 13 0M2.5 8.5a14 14 0 0 1 19 0" {...S} />
      <circle cx="12" cy="18" r="1.2" fill="currentColor" />
    </>
  ),
  save: (d) => (
    <>
      {d && <ellipse cx="12" cy="18" rx="7" ry="2" {...duo} />}
      <ellipse cx="12" cy="18" rx="7" ry="2" {...S} />
      <path d="M5 6.5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v9H5z" {...S} />
      <path d="M8 4.5h8v4H8z" {...S} />
    </>
  ),
  exam: (d) => (
    <>
      {d && <rect x="6" y="4" width="12" height="16" rx="2" {...duo} />}
      <rect x="6" y="4" width="12" height="16" rx="2" {...S} />
      <path d="M9 9h6M9 12.5h6M9 16h4" {...S} />
      <path d="m15.5 15.5 2 2 3.5-4" {...S} />
    </>
  ),
  moon: (d) => (
    <>
      {d && <path d="M18 5.5a7.5 7.5 0 1 0 2 10.5A6.5 6.5 0 1 1 18 5.5z" {...duo} />}
      <path d="M18 5.5a7.5 7.5 0 1 0 2 10.5A6.5 6.5 0 1 1 18 5.5z" {...S} />
    </>
  ),
  book: (d) => (
    <>
      {d && <path d="M5 4.5h7a3 3 0 0 1 3 3V19H8a3 3 0 0 0-3 3V4.5z" {...duo} />}
      <path d="M5 4.5h7a3 3 0 0 1 3 3V19H8a3 3 0 0 0-3 3V4.5z" {...S} />
      <path d="M12 7.5h7V22H12a3 3 0 0 1-3-3V7.5z" {...S} />
    </>
  ),
  search: (d) => (
    <>
      {d && <circle cx="11" cy="11" r="6" {...duo} />}
      <circle cx="11" cy="11" r="6" {...S} />
      <path d="m16.5 16.5 4.5 4.5" {...S} />
    </>
  ),
  medal: (d) => (
    <>
      {d && <circle cx="12" cy="14" r="5" {...duo} />}
      <circle cx="12" cy="14" r="5" {...S} />
      <path d="M9.5 6 12 9l2.5-3M8 6H6l2 4M16 6h2l-2 4" {...S} />
      <path d="M12 12v3" {...S} />
    </>
  ),
  gem: (d) => (
    <>
      {d && <path d="M12 3 20 9v6l-8 6-8-6V9z" {...duo} />}
      <path d="M12 3 20 9v6l-8 6-8-6V9z" {...S} />
      <path d="M4 9h16M12 3v18" {...S} />
    </>
  ),
  fork: () => (
    <>
      <path d="M6 4v8M18 4v8M6 8h12" {...S} />
      <path d="M6 12v8M18 12v8" {...S} />
    </>
  ),
  pin: (d) => (
    <>
      {d && <path d="M12 3c-2.2 0-4 1.8-4 4 0 3 4 8 4 8s4-5 4-8c0-2.2-1.8-4-4-4z" {...duo} />}
      <path d="M12 3c-2.2 0-4 1.8-4 4 0 3 4 8 4 8s4-5 4-8c0-2.2-1.8-4-4-4z" {...S} />
      <circle cx="12" cy="7" r="1.5" {...S} />
    </>
  ),
  puzzle: (d) => (
    <>
      {d && <path d="M8 4h3a2 2 0 0 0 4 0h3v3a2 2 0 0 0 0 4v3h-3a2 2 0 0 0-4 0H8v-3a2 2 0 0 0 0-4z" {...duo} />}
      <path
        d="M8 4h3a2 2 0 0 0 4 0h3v3a2 2 0 0 0 0 4v3h-3a2 2 0 0 0-4 0H8v-3a2 2 0 0 0 0-4z"
        {...S}
      />
    </>
  ),
  link: () => (
    <>
      <path d="M10 8a4 4 0 0 1 5.7 0l2 2a4 4 0 0 1 0 5.7l-1 1" {...S} />
      <path d="M14 16a4 4 0 0 1-5.7 0l-2-2a4 4 0 0 1 0-5.7l1-1" {...S} />
    </>
  ),
  rocket: (d) => (
    <>
      {d && <path d="M12 3c-2 4-4 6-4 9a4 4 0 0 0 8 0c0-3-2-5-4-9z" {...duo} />}
      <path d="M12 3c-2 4-4 6-4 9a4 4 0 0 0 8 0c0-3-2-5-4-9z" {...S} />
      <path d="M10 20h4M11 16l-1 4M13 16l1 4" {...S} />
      <circle cx="12" cy="11" r="1.5" fill="currentColor" />
    </>
  ),
  plug: (d) => (
    <>
      {d && <path d="M8 7v4a4 4 0 0 0 8 0V7" {...duo} />}
      <path d="M8 7V5a4 4 0 0 1 8 0v2M8 7v4a4 4 0 0 0 8 0V7" {...S} />
      <path d="M12 15v4M9 19h6" {...S} />
    </>
  ),
  knight: (d) => (
    <>
      {d && (
        <path
          d="M8 19h8M10 19c0-5 1-7.5 4-9.5 1.2-.7 2-2 2-3.5a2.5 2.5 0 0 0-5 0c0 1.2.5 2.2 1.5 3"
          {...duo}
        />
      )}
      <path
        d="M8 19h8M10 19c0-5 1-7.5 4-9.5 1.2-.7 2-2 2-3.5a2.5 2.5 0 0 0-5 0c0 1.2.5 2.2 1.5 3"
        {...S}
      />
      <path d="M15 6.5h2.5L16 9" {...S} />
    </>
  ),
  rook: (d) => (
    <>
      {d && <path d="M8 8h8v11H8z" {...duo} />}
      <path d="M8 5h8M9 5V3h6v2M8 8h8v11H8z" {...S} />
      <path d="M10 14h4" {...S} />
    </>
  ),
  bishop: (d) => (
    <>
      {d && (
        <path
          d="M12 4c-2.2 0-3.5 1.8-3.5 3.5S12 13 12 13s3.5-2.5 3.5-5.5S14.2 4 12 4z"
          {...duo}
        />
      )}
      <path
        d="M12 4c-2.2 0-3.5 1.8-3.5 3.5S12 13 12 13s3.5-2.5 3.5-5.5S14.2 4 12 4zM9 19h6"
        {...S}
      />
      <path d="M10 16h4" {...S} />
    </>
  ),
  queen: (d) => (
    <>
      {d && <path d="M6 8l2 4 4-5 4 5 2-4 2 9H4l2-9z" {...duo} />}
      <path d="M6 8l2 4 4-5 4 5 2-4 2 9H4l2-9z" {...S} />
      <circle cx="9" cy="7.5" r="0.8" fill="currentColor" />
      <circle cx="12" cy="5.5" r="0.8" fill="currentColor" />
      <circle cx="15" cy="7.5" r="0.8" fill="currentColor" />
    </>
  ),
  map: (d) => (
    <>
      {d && <path d="M4 6l6-2 8 2v12l-8-2-6 2V6z" {...duo} />}
      <path d="M4 6l6-2 8 2v12l-8-2-6 2V6z" {...S} />
      <path d="M10 4v12M18 8v12" {...S} />
    </>
  ),
  tree: (d) => (
    <>
      {d && <path d="M12 20V12M12 12 8 6h8l-4 6z" {...duo} />}
      <path d="M12 20V12M12 12 8 6h8l-4 6z" {...S} />
      <path d="M9 20h6" {...S} />
    </>
  ),
  wave: (d) => (
    <>
      {d && <path d="M6 12c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0" {...duo} />}
      <path d="M4 14V8.5a1.5 1.5 0 0 1 3 0V14M7 8.5V6.5a1.5 1.5 0 0 1 3 0v5" {...S} />
      <path d="M6 12c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0" {...S} />
    </>
  ),
  celebrate: (d) => (
    <>
      {d && <path d="M12 3v8l3-2 1 6-4-2-4 2 1-6 3 2V3z" {...duo} />}
      <path d="M12 3v8l3-2 1 6-4-2-4 2 1-6 3 2V3z" {...S} />
      <path d="M5 5l2 2M19 5l-2 2M6 18l1.5-1.5M18 18l-1.5-1.5" {...S} />
    </>
  ),
  building: (d) => (
    <>
      {d && <path d="M5 20V6l7-3 7 3v14H5z" {...duo} />}
      <path d="M5 20V6l7-3 7 3v14H5z" {...S} />
      <path d="M9 10h2M9 14h2M13 10h2M13 14h2" {...S} />
      <path d="M12 20v-4h-2v4" {...S} />
    </>
  ),
  scroll: (d) => (
    <>
      {d && <path d="M7 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 0-2 2V5z" {...duo} />}
      <path d="M7 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 0-2 2V5z" {...S} />
      <path d="M9 9h6M9 12.5h6" {...S} />
    </>
  ),
  backpack: (d) => (
    <>
      {d && <path d="M8 8V6a4 4 0 0 1 8 0v2l2 4v8H6l2-12z" {...duo} />}
      <path d="M8 8V6a4 4 0 0 1 8 0v2M6 12h12v8H6z" {...S} />
      <path d="M10 8h4" {...S} />
    </>
  ),
  heart: (d) => (
    <>
      {d && (
        <path
          d="M12 20s-6.5-4.2-8.5-8.2C1.8 8.5 3.5 5.5 6.5 5.5c1.7 0 3.2 1 3.5 2.5.3-1.5 1.8-2.5 3.5-2.5 3 0 4.7 3 3 6.3C18.5 15.8 12 20 12 20z"
          {...duo}
        />
      )}
      <path
        d="M12 20s-6.5-4.2-8.5-8.2C1.8 8.5 3.5 5.5 6.5 5.5c1.7 0 3.2 1 3.5 2.5.3-1.5 1.8-2.5 3.5-2.5 3 0 4.7 3 3 6.3C18.5 15.8 12 20 12 20z"
        {...S}
      />
    </>
  ),
};

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: number;
  duotone?: boolean;
}

export function Icon({
  name,
  size = 24,
  duotone = false,
  className,
  ...rest
}: IconProps) {
  const render = ICONS[name];
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      stroke="currentColor"
      aria-hidden
      {...rest}
    >
      {render(duotone)}
    </svg>
  );
}
