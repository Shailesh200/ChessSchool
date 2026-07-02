import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 } as const;

export type OgCardProps = {
  title: string;
  subtitle: string;
  badge: string;
  emoji?: string;
};

function truncate(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

/** Shared 1200×630 social preview card (WhatsApp, iMessage, Twitter, etc.). */
export function renderOgCard({ title, subtitle, badge, emoji = "♟️" }: OgCardProps) {
  const safeTitle = truncate(title, 72);
  const safeSubtitle = truncate(subtitle, 120);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px 64px",
          background: "linear-gradient(145deg, #7b6ff0 0%, #4b46c4 55%, #2a2546 100%)",
          color: "#fff",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
        }}
      >
        {/* subtle board grid */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexWrap: "wrap",
            opacity: 0.12,
          }}
        >
          {Array.from({ length: 64 }).map((_, i) => (
            <div
              key={i}
              style={{
                width: "12.5%",
                height: "12.5%",
                background: (Math.floor(i / 8) + i) % 2 === 0 ? "#ffffff" : "transparent",
              }}
            />
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16, zIndex: 1 }}>
          <div
            style={{
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: 0.5,
              padding: "10px 20px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.18)",
              border: "2px solid rgba(255,255,255,0.35)",
            }}
          >
            {badge}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 36, zIndex: 1 }}>
          <div style={{ fontSize: 120, lineHeight: 1, filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.25))" }}>
            {emoji}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
            <div
              style={{
                fontSize: 56,
                fontWeight: 800,
                lineHeight: 1.08,
                letterSpacing: -1,
                textShadow: "0 4px 24px rgba(0,0,0,0.2)",
              }}
            >
              {safeTitle}
            </div>
            <div style={{ fontSize: 28, fontWeight: 600, lineHeight: 1.35, color: "rgba(255,255,255,0.92)", maxWidth: 920 }}>
              {safeSubtitle}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            zIndex: 1,
            fontSize: 26,
            fontWeight: 700,
            color: "rgba(255,255,255,0.88)",
          }}
        >
          <span>ChessSchool · chess-school.in</span>
          <span>Learn chess · Play live · Graduate</span>
        </div>
      </div>
    ),
    { ...OG_SIZE },
  );
}
