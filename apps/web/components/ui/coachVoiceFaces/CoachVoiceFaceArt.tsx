import type { VoicePortraitSpec } from "./portraits";

function Hair({ spec }: { spec: VoicePortraitSpec }) {
  const { hair, hairStyle } = spec;
  switch (hairStyle) {
    case "wavy":
      return (
        <path
          d="M24 44 Q20 18 48 14 Q76 18 72 44 Q68 28 48 24 Q28 28 24 44 Z"
          fill={hair}
        />
      );
    case "bob":
      return (
        <path
          d="M26 42 Q24 20 48 16 Q72 20 70 48 Q66 36 48 32 Q30 36 26 42 Z"
          fill={hair}
        />
      );
    case "curly":
      return (
        <>
          <circle cx="30" cy="28" r="8" fill={hair} />
          <circle cx="48" cy="18" r="9" fill={hair} />
          <circle cx="66" cy="28" r="8" fill={hair} />
          <path d="M26 40 Q48 30 70 40 L68 50 Q48 38 28 50 Z" fill={hair} />
        </>
      );
    case "bun":
      return (
        <>
          <circle cx="48" cy="20" r="10" fill={hair} />
          <path d="M28 38 Q48 22 68 38 L64 46 Q48 34 32 46 Z" fill={hair} />
        </>
      );
    case "straight":
      return (
        <path
          d="M26 44 Q22 16 48 14 Q74 16 70 56 Q66 40 48 34 Q30 40 26 44 Z"
          fill={hair}
        />
      );
    case "short":
      return <path d="M30 40 Q48 18 66 40 L62 34 Q48 24 34 34 Z" fill={hair} />;
    case "spiky":
      return (
        <path
          d="M32 38 L38 16 L48 28 L58 14 L66 36 L60 32 L48 40 L36 32 Z"
          fill={hair}
        />
      );
    case "side":
      return (
        <path
          d="M28 42 Q26 20 50 16 Q72 22 70 44 Q64 30 50 26 Q34 30 28 42 Z"
          fill={hair}
        />
      );
    case "crop":
      return <ellipse cx="48" cy="28" rx="24" ry="14" fill={hair} />;
    case "messy":
      return (
        <path
          d="M26 40 Q34 14 48 20 Q62 12 70 38 Q64 26 48 30 Q32 34 26 40 Z"
          fill={hair}
        />
      );
    default:
      return null;
  }
}

function Eyes({ spec }: { spec: VoicePortraitSpec }) {
  const lash = spec.eye === "focused" ? 2.2 : 2.5;
  if (spec.glasses) {
    return (
      <>
        <circle cx="38" cy="44" r="9" fill="none" stroke="#334155" strokeWidth="2" />
        <circle cx="58" cy="44" r="9" fill="none" stroke="#334155" strokeWidth="2" />
        <path d="M47 44 H49" stroke="#334155" strokeWidth="2" />
        <circle cx="38" cy="44" r="3" fill="#1E293B" />
        <circle cx="58" cy="44" r="3" fill="#1E293B" />
      </>
    );
  }
  if (spec.eye === "round") {
    return (
      <>
        <circle cx="38" cy="44" r="4" fill="#1E293B" />
        <circle cx="58" cy="44" r="4" fill="#1E293B" />
        <circle cx="39" cy="43" r="1.2" fill="#F8FAFC" />
        <circle cx="59" cy="43" r="1.2" fill="#F8FAFC" />
      </>
    );
  }
  return (
    <>
      <ellipse cx="38" cy="44" rx="3.5" ry={lash} fill="#1E293B" />
      <ellipse cx="58" cy="44" rx="3.5" ry={lash} fill="#1E293B" />
    </>
  );
}

function Mouth({ spec }: { spec: VoicePortraitSpec }) {
  switch (spec.mouth) {
    case "grin":
      return (
        <path
          d="M38 54 Q48 62 58 54"
          stroke="#431407"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
      );
    case "smile":
      return (
        <path
          d="M40 54 Q48 59 56 54"
          stroke="#431407"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
      );
    case "firm":
      return (
        <path
          d="M42 56 L54 56"
          stroke="#431407"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      );
    default:
      return (
        <path
          d="M42 55 Q48 57 54 55"
          stroke="#431407"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
      );
  }
}

function Beard({ spec }: { spec: VoicePortraitSpec }) {
  if (!spec.beard || spec.beard === "none") return null;
  if (spec.beard === "stubble")
    return <ellipse cx="48" cy="58" rx="14" ry="10" fill={spec.hair} opacity="0.25" />;
  if (spec.beard === "goatee")
    return (
      <path d="M42 54 Q48 66 54 54 Q48 62 42 54" fill={spec.hair} opacity="0.85" />
    );
  return (
    <path
      d="M34 52 Q48 68 62 52 Q58 62 48 64 Q38 62 34 52"
      fill={spec.hair}
      opacity="0.9"
    />
  );
}

function Detail({ spec }: { spec: VoicePortraitSpec }) {
  switch (spec.detail) {
    case "bindi":
      return <circle cx="48" cy="34" r="2.5" fill="#DC2626" />;
    case "freckles":
      return (
        <>
          <circle cx="42" cy="50" r="1" fill="#C2410C" opacity="0.5" />
          <circle cx="52" cy="48" r="1" fill="#C2410C" opacity="0.5" />
          <circle cx="46" cy="52" r="1" fill="#C2410C" opacity="0.5" />
        </>
      );
    case "earring":
      return <circle cx="70" cy="48" r="2" fill="#FBBF24" />;
    case "sparkle":
      return (
        <>
          <path
            d="M20 24 L22 28 L26 26 L22 30 L20 34 L18 30 L14 28 L18 26 Z"
            fill="#FDE047"
          />
          <path
            d="M74 20 L75 23 L78 22 L75 25 L74 28 L73 25 L70 22 L73 23 Z"
            fill="#A78BFA"
          />
          <path
            d="M76 58 L77 60 L79 59 L77 61 L76 63 L75 61 L73 59 L75 60 Z"
            fill="#F472B6"
          />
        </>
      );
    default:
      return null;
  }
}

/** Original flat human portrait for TTS voice picker. */
export function CoachVoiceFaceArt({ spec }: { spec: VoicePortraitSpec }) {
  return (
    <>
      <ellipse cx="48" cy="80" rx="20" ry="12" fill={spec.shirt} />
      <rect x="38" y="66" width="20" height="16" rx="4" fill={spec.shirt} />
      <Hair spec={spec} />
      <circle cx="48" cy="46" r="22" fill={spec.skin} />
      <Eyes spec={spec} />
      <Mouth spec={spec} />
      <Beard spec={spec} />
      <Detail spec={spec} />
      {spec.detail === "sparkle" && (
        <path
          d="M40 54 Q48 60 56 54"
          stroke="#7C3AED"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          opacity="0.6"
        />
      )}
    </>
  );
}
