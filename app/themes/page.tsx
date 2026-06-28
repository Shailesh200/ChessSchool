"use client";

import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useSettings, type PieceTheme } from "@/core/store/settings.store";
import { useMounted } from "@/core/hooks/useMounted";
import {
  BOARD_THEMES,
  SELECTABLE_BOARD_THEMES,
  SCHOOL_THEMES,
  APP_THEMES,
  getBoardTheme,
} from "@/core/themes/themes";
import { PIECE_THEMES, PiecePreview } from "@/features/board/pieceThemes";
import { haptics } from "@/core/haptics/haptics";
import { audio } from "@/core/audio/audioEngine";

function MiniBoard({ themeId, size = 8 }: { themeId: string; size?: number }) {
  const t = getBoardTheme(themeId);
  return (
    <div
      className="grid overflow-hidden rounded-lg"
      style={{ gridTemplateColumns: `repeat(${size}, 1fr)`, aspectRatio: "1 / 1" }}
      aria-hidden
    >
      {Array.from({ length: size * size }).map((_, i) => {
        const r = Math.floor(i / size);
        const dark = (r + (i % size)) % 2 === 1;
        return <div key={i} style={{ background: dark ? t.dark : t.light }} />;
      })}
    </div>
  );
}

export default function ThemesPage() {
  const mounted = useMounted();
  const boardTheme = useSettings((s) => s.boardTheme);
  const pieceTheme = useSettings((s) => s.pieceTheme);
  const schoolTheme = useSettings((s) => s.schoolTheme);
  const appTheme = useSettings((s) => s.appTheme);
  const set = useSettings((s) => s.set);

  if (!mounted) {
    return (
      <AppShell>
        <div className="skeleton h-96 rounded-card" />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="text-xl font-extrabold text-ink">Theme Studio</h1>
          <p className="text-sm font-semibold text-ink-500">Preview and switch instantly.</p>
        </div>

        {/* Live preview */}
        <Card className="flex items-center gap-4">
          <div className="w-28 shrink-0">
            <MiniBoard themeId={boardTheme} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="inline-block rounded-pill bg-brand px-2 py-0.5 text-xs font-extrabold text-white">
              Live preview
            </span>
            <p className="mt-1 truncate text-sm font-extrabold text-ink">
              {getBoardTheme(boardTheme).name} board
            </p>
            <Button size="sm" className="mt-2">Continue</Button>
          </div>
        </Card>

        {/* App color themes */}
        <section>
          <h2 className="mb-2 text-sm font-extrabold text-ink">App theme</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {APP_THEMES.map((t) => {
              const active = appTheme === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => { set("appTheme", t.id); haptics.fire("select"); audio.play("transition"); }}
                  className={`btn-tactile flex items-center gap-2 rounded-card border-2 p-2.5 ${
                    active ? "border-brand bg-brand-50" : "border-hairline bg-surface-card"
                  }`}
                >
                  <span className="flex h-8 w-8 shrink-0 overflow-hidden rounded-lg border border-hairline">
                    <span className="w-1/3" style={{ background: t.swatch[0] }} />
                    <span className="w-1/3" style={{ background: t.swatch[1] }} />
                    <span className="w-1/3" style={{ background: t.swatch[2] }} />
                  </span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-xs font-extrabold text-ink">{t.emoji} {t.name}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Board themes */}
        <section>
          <h2 className="mb-2 text-sm font-extrabold text-ink">Board themes</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {SELECTABLE_BOARD_THEMES.map((id) => {
              const active = boardTheme === id;
              return (
                <button
                  key={id}
                  onClick={() => { set("boardTheme", id); haptics.fire("select"); audio.play("transition"); }}
                  className={`btn-tactile rounded-card border-2 p-2 ${
                    active ? "border-brand bg-brand-50" : "border-hairline bg-surface-card"
                  }`}
                >
                  <MiniBoard themeId={id} size={6} />
                  <p className="mt-1.5 truncate text-xs font-extrabold text-ink">{BOARD_THEMES[id]!.name}</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Piece sets */}
        <section>
          <h2 className="mb-2 text-sm font-extrabold text-ink">Piece sets</h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {PIECE_THEMES.map((p) => {
              const active = pieceTheme === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => { set("pieceTheme", p.id as PieceTheme); haptics.fire("select"); audio.play("transition"); }}
                  className={`btn-tactile flex flex-col items-center gap-1 rounded-card border-2 p-2 ${
                    active ? "border-brand bg-brand-50" : "border-hairline bg-surface-card"
                  }`}
                >
                  <div className="rounded-lg bg-surface-sunken px-1 py-1.5">
                    <PiecePreview themeId={p.id} />
                  </div>
                  <p className="truncate text-[11px] font-extrabold text-ink">{p.emoji} {p.name}</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* School themes */}
        <section>
          <h2 className="mb-2 text-sm font-extrabold text-ink">School themes</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {SCHOOL_THEMES.map((t) => {
              const active = schoolTheme === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => { set("schoolTheme", t.id); haptics.fire("select"); audio.play("transition"); }}
                  className={`btn-tactile flex flex-col items-center gap-1 rounded-card border-2 p-3 ${
                    active ? "border-brand bg-brand-50" : "border-hairline bg-surface-card"
                  }`}
                >
                  <span className="text-2xl">{t.emoji}</span>
                  <span className="truncate text-xs font-extrabold text-ink">{t.name}</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
