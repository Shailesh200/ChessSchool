import { ART_FADES, MOTIFS, type ArtFade, type ArtTone, type Backdrop as Art } from "@chessschool/design";
import { memo, useId } from "react";

const TONE: Record<ArtTone, string> = { brand: "var(--cs-brand)", accent: "var(--cs-accent)", gold: "var(--cs-gold)", success: "var(--cs-success)", text: "var(--cs-text)" };

/** The fade as a CSS mask, so the art fades out over any background (gradients included). */
function mask(fade: ArtFade): string {
  const stops = ART_FADES[fade].map(([offset, show]) => `rgba(0,0,0,${show}) ${offset * 100}%`).join(", ");
  return fade === "corner" ? `radial-gradient(farthest-corner at 100% 0, ${stops})` : `linear-gradient(to bottom, ${stops})`;
}

/**
 * Decorative background art (data in @chessschool/design backdrops.ts). `fixed` pins it to the viewport so
 * page content scrolls over it; otherwise it fills its parent card (`.has-art`). Hidden from assistive tech.
 * Colours go through `style` so the theme's CSS variables resolve.
 */
export const Backdrop = memo(function Backdrop({ art, fixed }: { art: Art; fixed?: boolean }) {
  const pid = `art-${art.id}-${useId().replace(/[^\w-]/g, "")}`;
  const m = mask(art.fade);
  return (
    <div className={fixed ? "backdrop backdrop-fixed" : "backdrop"} aria-hidden="true">
      <svg width="100%" height="100%" focusable="false" style={{ maskImage: m, WebkitMaskImage: m }}>
        <defs>
          <pattern id={pid} patternUnits="userSpaceOnUse" width={art.tile.size} height={art.tile.size}>
            <g style={{ opacity: `min(1, calc(${art.o} * var(--cs-art, 1)))` }}>
              {art.tile.ops.map((op, i) => (op.stroke ? <path key={i} d={op.d} fill="none" style={{ stroke: TONE[art.tone] }} strokeWidth={op.stroke} opacity={op.o ?? 1} /> : <path key={i} d={op.d} style={{ fill: TONE[art.tone] }} opacity={op.o ?? 1} />))}
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${pid})`} />
      </svg>
      {art.motifs.map((mo, i) => (
        <svg
          key={i}
          className="backdrop-motif"
          viewBox="0 0 100 100"
          width={mo.size}
          height={mo.size}
          focusable="false"
          style={{ left: `${mo.x * 100}%`, top: `${mo.y * 100}%`, marginLeft: -mo.size / 2, marginTop: -mo.size / 2, transform: `rotate(${mo.rotate}deg)`, opacity: `min(1, calc(${mo.o} * var(--cs-art, 1)))` }}
        >
          {MOTIFS[mo.shape].map((d, j) => (
            <path key={j} d={d} style={{ fill: TONE[mo.tone] }} />
          ))}
        </svg>
      ))}
    </div>
  );
});
