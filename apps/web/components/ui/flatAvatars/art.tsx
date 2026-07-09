import type { FlatAvatarId } from "./catalog";

/** Original flat character art — simple shapes, no third-party assets. */
export function FlatAvatarArt({ id }: { id: FlatAvatarId }) {
  switch (id) {
    case "bot-pip":
      return (
        <>
          <ellipse cx="48" cy="78" rx="22" ry="14" fill="#FACC15" opacity="0.35" />
          <circle cx="48" cy="44" r="26" fill="#FFFBEB" />
          <circle cx="48" cy="50" r="22" fill="#FEF08A" />
          <circle cx="38" cy="46" r="4" fill="#422006" />
          <circle cx="58" cy="46" r="4" fill="#422006" />
          <path d="M40 56 Q48 62 56 56" stroke="#422006" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M34 28 Q48 8 62 28 L58 36 Q48 22 38 36 Z" fill="#F97316" />
          <ellipse cx="48" cy="72" rx="16" ry="10" fill="#FDE047" />
        </>
      );
    case "bot-cody":
      return (
        <>
          <circle cx="48" cy="44" r="26" fill="#F0F9FF" />
          <circle cx="48" cy="48" r="22" fill="#FFEDD5" />
          <circle cx="38" cy="46" r="3.5" fill="#1E293B" />
          <circle cx="58" cy="46" r="3.5" fill="#1E293B" />
          <path d="M42 56 Q48 61 54 56" stroke="#1E293B" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M28 38 Q48 18 68 38 L64 44 Q48 28 32 44 Z" fill="#0EA5E9" />
          <rect x="40" y="68" width="16" height="14" rx="6" fill="#38BDF8" />
        </>
      );
    case "bot-remi":
      return (
        <>
          <circle cx="48" cy="44" r="26" fill="#F0FDF4" />
          <circle cx="48" cy="48" r="22" fill="#DCFCE7" />
          <circle cx="38" cy="46" r="3.5" fill="#14532D" />
          <circle cx="58" cy="46" r="3.5" fill="#14532D" />
          <path d="M42 56 Q48 60 54 56" stroke="#14532D" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M30 34 L48 20 L66 34 L62 40 L48 30 L34 40 Z" fill="#22C55E" />
          <path d="M48 30 L48 18" stroke="#15803D" strokeWidth="3" strokeLinecap="round" />
          <circle cx="48" cy="16" r="4" fill="#15803D" />
        </>
      );
    case "bot-sasha":
      return (
        <>
          <circle cx="48" cy="44" r="26" fill="#FEF2F2" />
          <circle cx="48" cy="48" r="22" fill="#FECACA" />
          <circle cx="38" cy="46" r="3.5" fill="#450A0A" />
          <circle cx="58" cy="46" r="3.5" fill="#450A0A" />
          <path d="M42 55 Q48 58 54 55" stroke="#450A0A" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M26 52 L48 28 L70 52 L64 58 L48 40 L32 58 Z" fill="#EF4444" />
          <rect x="44" y="62" width="8" height="18" rx="2" fill="#94A3B8" />
        </>
      );
    case "bot-vera":
      return (
        <>
          <circle cx="48" cy="44" r="26" fill="#FAF5FF" />
          <circle cx="48" cy="48" r="22" fill="#EDE9FE" />
          <circle cx="38" cy="46" r="3.5" fill="#3B0764" />
          <circle cx="58" cy="46" r="3.5" fill="#3B0764" />
          <path d="M42 56 Q48 60 54 56" stroke="#3B0764" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M24 36 L36 24 L48 32 L60 24 L72 36 L68 42 L48 28 L28 42 Z" fill="#A855F7" />
          <circle cx="36" cy="26" r="3" fill="#FDE047" />
          <circle cx="48" cy="22" r="3" fill="#FDE047" />
          <circle cx="60" cy="26" r="3" fill="#FDE047" />
        </>
      );
    case "bot-magnus":
      return (
        <>
          <circle cx="48" cy="44" r="26" fill="#FFFBEB" />
          <circle cx="48" cy="48" r="22" fill="#FEF3C7" />
          <circle cx="38" cy="46" r="3.5" fill="#422006" />
          <circle cx="58" cy="46" r="3.5" fill="#422006" />
          <path d="M42 56 Q48 60 54 56" stroke="#422006" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M22 38 L48 14 L74 38 L70 44 L48 26 L26 44 Z" fill="#D97706" />
          <circle cx="48" cy="16" r="5" fill="#FBBF24" />
          <rect x="34" y="66" width="28" height="12" rx="4" fill="#92400E" />
        </>
      );
    case "bot-titan":
      return (
        <>
          <rect x="22" y="24" width="52" height="48" rx="12" fill="#CBD5E1" />
          <rect x="28" y="30" width="40" height="34" rx="8" fill="#64748B" />
          <circle cx="38" cy="44" r="5" fill="#22D3EE" />
          <circle cx="58" cy="44" r="5" fill="#22D3EE" />
          <rect x="36" y="56" width="24" height="4" rx="2" fill="#334155" />
          <rect x="18" y="36" width="8" height="24" rx="3" fill="#94A3B8" />
          <rect x="70" y="36" width="8" height="24" rx="3" fill="#94A3B8" />
        </>
      );
    case "coach-friendly":
      return (
        <>
          <circle cx="48" cy="46" r="24" fill="#FFEDD5" />
          <circle cx="38" cy="44" r="3" fill="#431407" />
          <circle cx="58" cy="44" r="3" fill="#431407" />
          <path d="M40 54 Q48 60 56 54" stroke="#431407" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M18 58 Q28 42 38 52" stroke="#FB923C" strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M30 28 Q48 14 66 28 L62 34 Q48 22 34 34 Z" fill="#EA580C" />
        </>
      );
    case "coach-strict":
      return (
        <>
          <circle cx="48" cy="46" r="24" fill="#E5E7EB" />
          <path d="M34 42 L42 44 L34 46" stroke="#111827" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M62 42 L54 44 L62 46" stroke="#111827" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M44 56 L52 56" stroke="#111827" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M24 30 L48 18 L72 30 L68 36 L48 24 L28 36 Z" fill="#374151" />
          <rect x="40" y="66" width="16" height="10" rx="3" fill="#1F2937" />
        </>
      );
    case "coach-mentor":
      return (
        <>
          <circle cx="48" cy="46" r="24" fill="#DBEAFE" />
          <circle cx="38" cy="44" r="3" fill="#1E3A8A" />
          <circle cx="58" cy="44" r="3" fill="#1E3A8A" />
          <path d="M40 54 Q48 58 56 54" stroke="#1E3A8A" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <rect x="28" y="62" width="40" height="16" rx="4" fill="#2563EB" />
          <path d="M32 62 L48 48 L64 62" fill="#1D4ED8" />
          <circle cx="48" cy="24" r="8" fill="#BFDBFE" />
        </>
      );
    case "coach-tactical":
      return (
        <>
          <circle cx="48" cy="46" r="24" fill="#FFE4E6" />
          <circle cx="38" cy="44" r="3" fill="#881337" />
          <circle cx="58" cy="44" r="3" fill="#881337" />
          <path d="M42 55 L54 55" stroke="#881337" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M58 28 L72 68 L58 64 L44 68 Z" fill="#E11D48" />
          <rect x="54" y="62" width="6" height="14" rx="1" fill="#64748B" />
        </>
      );
    case "ava-bunny":
      return (
        <>
          <ellipse cx="36" cy="22" rx="8" ry="18" fill="#F9A8D4" />
          <ellipse cx="60" cy="22" rx="8" ry="18" fill="#F9A8D4" />
          <circle cx="48" cy="50" r="24" fill="#FCE7F3" />
          <circle cx="38" cy="48" r="3" fill="#831843" />
          <circle cx="58" cy="48" r="3" fill="#831843" />
          <circle cx="48" cy="56" r="4" fill="#F472B6" />
        </>
      );
    case "ava-fox":
      return (
        <>
          <path d="M24 36 L48 16 L72 36 L64 48 L48 34 L32 48 Z" fill="#FB923C" />
          <circle cx="48" cy="52" r="22" fill="#FFEDD5" />
          <circle cx="38" cy="50" r="3" fill="#431407" />
          <circle cx="58" cy="50" r="3" fill="#431407" />
          <path d="M44 58 L48 62 L52 58" fill="#431407" />
        </>
      );
    case "ava-owl":
      return (
        <>
          <ellipse cx="48" cy="50" rx="26" ry="28" fill="#C7D2FE" />
          <circle cx="38" cy="46" r="9" fill="#F8FAFC" />
          <circle cx="58" cy="46" r="9" fill="#F8FAFC" />
          <circle cx="38" cy="46" r="4" fill="#312E81" />
          <circle cx="58" cy="46" r="4" fill="#312E81" />
          <path d="M48 52 L44 58 L52 58 Z" fill="#F59E0B" />
          <path d="M30 28 Q48 18 66 28" stroke="#6366F1" strokeWidth="4" fill="none" strokeLinecap="round" />
        </>
      );
    case "ava-bear":
      return (
        <>
          <circle cx="30" cy="30" r="10" fill="#A8A29E" />
          <circle cx="66" cy="30" r="10" fill="#A8A29E" />
          <circle cx="48" cy="50" r="26" fill="#D6D3D1" />
          <circle cx="38" cy="48" r="3" fill="#292524" />
          <circle cx="58" cy="48" r="3" fill="#292524" />
          <ellipse cx="48" cy="56" rx="8" ry="6" fill="#78716C" />
        </>
      );
    case "ava-sunflower":
      return (
        <>
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <ellipse
              key={deg}
              cx="48"
              cy="22"
              rx="8"
              ry="14"
              fill="#FDE047"
              transform={`rotate(${deg} 48 48)`}
            />
          ))}
          <circle cx="48" cy="48" r="16" fill="#854D0E" />
          <circle cx="48" cy="48" r="10" fill="#CA8A04" />
        </>
      );
    case "ava-rose":
      return (
        <>
          <path d="M48 72 Q48 52 48 40" stroke="#15803D" strokeWidth="4" strokeLinecap="round" />
          <ellipse cx="48" cy="36" rx="18" ry="16" fill="#FB7185" />
          <ellipse cx="40" cy="32" rx="10" ry="12" fill="#FDA4AF" />
          <ellipse cx="56" cy="32" rx="10" ry="12" fill="#FDA4AF" />
          <circle cx="48" cy="34" r="6" fill="#BE123C" />
        </>
      );
    case "ava-oak":
      return (
        <>
          <rect x="44" y="52" width="8" height="24" rx="3" fill="#92400E" />
          <circle cx="48" cy="36" r="22" fill="#86EFAC" />
          <circle cx="36" cy="40" r="14" fill="#4ADE80" />
          <circle cx="60" cy="40" r="14" fill="#4ADE80" />
        </>
      );
    case "ava-knight":
      return (
        <>
          <circle cx="48" cy="48" r="26" fill="#E0F2FE" />
          <path d="M32 68 Q36 40 48 32 Q58 40 64 68" fill="#0EA5E9" />
          <path d="M38 36 Q48 24 58 36 L54 42 Q48 34 42 42 Z" fill="#0284C7" />
          <circle cx="42" cy="46" r="3" fill="#0C4A6E" />
          <circle cx="54" cy="46" r="3" fill="#0C4A6E" />
        </>
      );
    case "ava-queen":
      return (
        <>
          <circle cx="48" cy="48" r="26" fill="#F3E8FF" />
          <path d="M24 36 L32 24 L40 34 L48 20 L56 34 L64 24 L72 36 L68 42 L48 30 L28 42 Z" fill="#A855F7" />
          <circle cx="32" cy="26" r="3" fill="#FDE047" />
          <circle cx="48" cy="20" r="3" fill="#FDE047" />
          <circle cx="64" cy="26" r="3" fill="#FDE047" />
          <circle cx="40" cy="50" r="3" fill="#581C87" />
          <circle cx="56" cy="50" r="3" fill="#581C87" />
        </>
      );
    case "ava-rook":
      return (
        <>
          <rect x="28" y="32" width="40" height="36" rx="4" fill="#78716C" />
          <rect x="32" y="24" width="8" height="8" fill="#57534E" />
          <rect x="44" y="24" width="8" height="8" fill="#57534E" />
          <rect x="56" y="24" width="8" height="8" fill="#57534E" />
          <rect x="34" y="44" width="28" height="6" rx="2" fill="#44403C" />
          <circle cx="48" cy="58" r="6" fill="#D6D3D1" />
        </>
      );
    case "ava-bishop":
      return (
        <>
          <ellipse cx="48" cy="58" rx="14" ry="18" fill="#DDD6FE" />
          <path d="M48 22 Q36 40 36 56 Q48 50 60 56 Q60 40 48 22" fill="#8B5CF6" />
          <circle cx="48" cy="24" r="5" fill="#C4B5FD" />
          <path d="M44 66 L52 66" stroke="#5B21B6" strokeWidth="3" strokeLinecap="round" />
        </>
      );
    case "ava-rocket":
      return (
        <>
          <path d="M48 18 Q58 38 58 58 L48 68 L38 58 Q38 38 48 18" fill="#3B82F6" />
          <circle cx="48" cy="42" r="6" fill="#BFDBFE" />
          <path d="M38 58 L28 72 L38 66 Z" fill="#EF4444" />
          <path d="M58 58 L68 72 L58 66 Z" fill="#EF4444" />
          <path d="M44 68 L48 78 L52 68" fill="#F97316" />
        </>
      );
    case "ava-gem":
      return (
        <>
          <path d="M48 20 L68 40 L58 72 L38 72 L28 40 Z" fill="#2DD4BF" />
          <path d="M48 20 L68 40 L48 48 L28 40 Z" fill="#5EEAD4" />
          <path d="M48 48 L68 40 L58 72 L48 72 Z" fill="#14B8A6" />
          <path d="M48 48 L28 40 L38 72 L48 72 Z" fill="#0D9488" />
        </>
      );
    case "ava-trophy":
      return (
        <>
          <path d="M32 28 H64 V44 Q64 56 48 56 Q32 56 32 44 Z" fill="#FBBF24" />
          <path d="M24 32 Q24 44 32 44 V36 H24" stroke="#D97706" strokeWidth="3" fill="none" />
          <path d="M72 32 Q72 44 64 44 V36 H72" stroke="#D97706" strokeWidth="3" fill="none" />
          <rect x="40" y="56" width="16" height="8" fill="#D97706" />
          <rect x="34" y="64" width="28" height="8" rx="2" fill="#92400E" />
        </>
      );
    case "ava-star":
      return (
        <>
          <path
            d="M48 18 L54 38 L76 38 L58 50 L66 72 L48 58 L30 72 L38 50 L20 38 L42 38 Z"
            fill="#38BDF8"
          />
          <circle cx="48" cy="46" r="8" fill="#BAE6FD" />
        </>
      );
    default:
      return null;
  }
}
