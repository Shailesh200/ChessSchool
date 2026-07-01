import Svg, { Path, Rect, Circle, type NumberProp } from "react-native-svg";
import { colors } from "./theme";

/** ChessSchool icon set — ported 1:1 from the web Icon.tsx (react-native-svg). */
export type IconName =
  | "learn" | "play" | "review" | "profile" | "flame" | "cap" | "chart" | "calendar"
  | "journal" | "palette" | "flask" | "gear" | "check" | "lock" | "close" | "arrowRight"
  | "chevronRight" | "star" | "trophy" | "sparkle" | "bulb" | "share" | "undo" | "flip"
  | "plus" | "target" | "dna" | "compass" | "eye" | "eyeOff";

export function Icon({
  name,
  size = 24,
  color = colors.ink,
  duotone = false,
}: {
  name: IconName;
  size?: number;
  color?: string;
  duotone?: boolean;
}) {
  const s = {
    stroke: color,
    strokeWidth: 2 as NumberProp,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };
  const sf = { ...s, fill: color };
  const duo = { fill: color, opacity: 0.16 };
  const fill = { fill: color };

  const icons: Record<IconName, React.ReactNode> = {
    learn: (
      <>
        {duotone && <Path d="M4 5.5A2 2 0 0 1 6 4h5v15H6a2 2 0 0 0-2 1z" {...duo} />}
        <Path d="M12 5c-1-1-2.5-1.5-5-1.5C5.5 3.5 4 4 4 5v13c2.5 0 4 .5 5 1.5 1-1 2.5-1.5 5-1.5V4c-1.5 0-3 0-4 1Z" {...s} />
        <Path d="M12 5v14" {...s} />
      </>
    ),
    play: (
      <>
        {duotone && <Rect x="3" y="4" width="18" height="16" rx="4" {...duo} />}
        <Rect x="3" y="4" width="18" height="16" rx="4" {...s} />
        <Path d="M10 9.5l5 2.5-5 2.5z" {...sf} />
      </>
    ),
    review: (
      <>
        {duotone && <Circle cx="12" cy="12" r="8" {...duo} />}
        <Path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5" {...s} />
        <Path d="M3 4v4h4" {...s} />
        <Path d="M12 8v4l3 2" {...s} />
      </>
    ),
    profile: (
      <>
        {duotone && <Circle cx="12" cy="9" r="4" {...duo} />}
        <Circle cx="12" cy="9" r="3.5" {...s} />
        <Path d="M5 20c1.2-3.6 4-5.5 7-5.5s5.8 1.9 7 5.5" {...s} />
      </>
    ),
    flame: <Path d="M12 3c1.8 3.5 5 4.2 5 8.5a5 5 0 0 1-10 0c0-1.8.8-2.8 1.8-3.7.4 1.8 1.7 1.8 1.7 0 0-1.8-.8-3 1.5-4.8Z" {...fill} />,
    cap: (
      <>
        {duotone && <Path d="M3 9l9-4 9 4-9 4z" {...duo} />}
        <Path d="M3 9l9-4 9 4-9 4-9-4Z" {...s} />
        <Path d="M7 11v4c0 1.3 2.2 2.5 5 2.5s5-1.2 5-2.5v-4" {...s} />
        <Path d="M21 9v4" {...s} />
      </>
    ),
    chart: (
      <>
        {duotone && <Rect x="3" y="4" width="18" height="16" rx="3" {...duo} />}
        <Rect x="3" y="4" width="18" height="16" rx="3" {...s} />
        <Path d="M7.5 15v-3M12 15V9M16.5 15v-5" {...s} />
      </>
    ),
    calendar: (
      <>
        {duotone && <Rect x="3.5" y="5" width="17" height="15" rx="3" {...duo} />}
        <Rect x="3.5" y="5" width="17" height="15" rx="3" {...s} />
        <Path d="M3.5 9.5h17M8 3v4M16 3v4" {...s} />
      </>
    ),
    journal: (
      <>
        {duotone && <Rect x="5" y="3.5" width="13" height="17" rx="2.5" {...duo} />}
        <Path d="M7 3.5h9a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" {...s} />
        <Path d="M6 16.5h12M9.5 7.5h5M9.5 11h5" {...s} />
      </>
    ),
    palette: (
      <>
        {duotone && <Path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.4 0 2-1 2-2s-.5-1.5 0-2.5 3-.5 3.5-2A8.5 8.5 0 0 0 12 3.5Z" {...duo} />}
        <Path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.4 0 2-1 2-2s-.5-1.5 0-2.5 3-.5 3.5-2A8.5 8.5 0 0 0 12 3.5Z" {...s} />
        <Circle cx="8" cy="11" r="1" {...fill} />
        <Circle cx="12" cy="8" r="1" {...fill} />
        <Circle cx="16" cy="11" r="1" {...fill} />
      </>
    ),
    flask: (
      <>
        {duotone && <Path d="M10 3.5v6l-4.5 7.5A2 2 0 0 0 7.2 20h9.6a2 2 0 0 0 1.7-3L14 9.5v-6z" {...duo} />}
        <Path d="M9.5 3.5h5M10 3.5v6l-4.5 7.5A2 2 0 0 0 7.2 20h9.6a2 2 0 0 0 1.7-3L14 9.5v-6" {...s} />
        <Path d="M8 14.5h8" {...s} />
      </>
    ),
    gear: (
      <>
        {duotone && <Circle cx="12" cy="12" r="8.5" {...duo} />}
        <Circle cx="12" cy="12" r="3" {...s} />
        <Path d="M12 2.5v2.5M12 19v2.5M21.5 12H19M5 12H2.5M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8M18.7 18.7l-1.8-1.8M7.1 7.1 5.3 5.3" {...s} />
      </>
    ),
    check: <Path d="M5 12.5l4.5 4.5L19 7" {...s} />,
    lock: (
      <>
        {duotone && <Rect x="5" y="10.5" width="14" height="10" rx="2.5" {...duo} />}
        <Rect x="5" y="10.5" width="14" height="10" rx="2.5" {...s} />
        <Path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" {...s} />
      </>
    ),
    close: <Path d="M6 6l12 12M18 6L6 18" {...s} />,
    arrowRight: <Path d="M5 12h14M13 6l6 6-6 6" {...s} />,
    chevronRight: <Path d="M9 6l6 6-6 6" {...s} />,
    star: <Path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17l-5.2 2.6 1-5.8L3.5 9.7l5.9-.9z" {...fill} />,
    trophy: (
      <>
        {duotone && <Path d="M7 4h10v5a5 5 0 0 1-10 0z" {...duo} />}
        <Path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" {...s} />
        <Path d="M7 6H4.5v1A3.5 3.5 0 0 0 8 10.5M17 6h2.5v1a3.5 3.5 0 0 1-3.5 3.5M12 14v3M8.5 20h7M9.5 20c0-1.5 1-2.5 2.5-2.5s2.5 1 2.5 2.5" {...s} />
      </>
    ),
    sparkle: <Path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6zM18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8z" {...fill} />,
    bulb: (
      <>
        {duotone && <Circle cx="12" cy="10" r="6" {...duo} />}
        <Path d="M9 16a6 6 0 1 1 6 0c-.6.5-1 1-1 2H10c0-1-.4-1.5-1-2Z" {...s} />
        <Path d="M10 20h4M10.5 22h3" {...s} />
      </>
    ),
    share: (
      <>
        <Circle cx="6" cy="12" r="2.2" {...s} />
        <Circle cx="17" cy="6" r="2.2" {...s} />
        <Circle cx="17" cy="18" r="2.2" {...s} />
        <Path d="M8 11l7-4M8 13l7 4" {...s} />
      </>
    ),
    undo: <Path d="M4 9h9a5 5 0 0 1 0 10h-4M4 9l4-4M4 9l4 4" {...s} />,
    flip: <Path d="M4 8a8 8 0 0 1 14-3M20 5v4h-4M20 16a8 8 0 0 1-14 3M4 19v-4h4" {...s} />,
    plus: <Path d="M12 5v14M5 12h14" {...s} />,
    target: (
      <>
        {duotone && <Circle cx="12" cy="12" r="8.5" {...duo} />}
        <Circle cx="12" cy="12" r="8.5" {...s} />
        <Circle cx="12" cy="12" r="4.5" {...s} />
        <Circle cx="12" cy="12" r="1.2" {...fill} />
      </>
    ),
    dna: <Path d="M7 3c0 4 10 6 10 9s-10 5-10 9M17 3c0 4-10 6-10 9s10 5 10 9M8 6h8M8 18h8M9.5 9h5M9.5 15h5" {...s} />,
    compass: (
      <>
        {duotone && <Circle cx="12" cy="12" r="8.5" {...duo} />}
        <Circle cx="12" cy="12" r="8.5" {...s} />
        <Path d="M15.5 8.5l-2 5-5 2 2-5z" {...sf} />
      </>
    ),
    eye: (
      <>
        <Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" {...s} />
        <Circle cx="12" cy="12" r="3" {...s} />
      </>
    ),
    eyeOff: (
      <>
        <Path d="M3 3l18 18M10.5 10.5a3 3 0 0 0 4.24 4.24M9.9 5.1A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a18.2 18.2 0 0 1-4.12 5.12M6.12 6.12A18.5 18.5 0 0 0 2 12s3.5 7 10 7a10.7 10.7 0 0 0 4.9-1.2" {...s} />
      </>
    ),
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {icons[name]}
    </Svg>
  );
}
