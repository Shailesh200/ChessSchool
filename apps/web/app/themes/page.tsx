"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ChessBoard } from "@/features/board/ChessBoard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useSettings, type PieceTheme } from "@/core/store/settings.store";
import {
  BOARD_THEMES,
  SELECTABLE_BOARD_THEMES,
  SCHOOL_THEMES,
  APP_THEMES,
  getBoardTheme,
} from "@/core/themes/themes";
import { PIECE_THEMES, PiecePreview } from "@/features/board/pieceThemes";
import { BackButton } from "@/components/ui/BackButton";
import { ContentIcon } from "@/components/ui/ContentIcon";
import { haptics } from "@/core/haptics/haptics";
import { audio } from "@/core/audio/audioEngine";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

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
  const boardTheme = useSettings((s) => s.boardTheme);
  const pieceTheme = useSettings((s) => s.pieceTheme);
  const schoolTheme = useSettings((s) => s.schoolTheme);
  const appTheme = useSettings((s) => s.appTheme);
  const set = useSettings((s) => s.set);
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <AppShell>
      <div className="flex flex-col gap-5 lg:gap-6">
        <BackButton />
        <div>
          <h1 className="text-ink text-xl font-extrabold lg:text-2xl">Theme Studio</h1>
          <p className="text-ink-500 text-sm font-semibold">
            Preview and switch instantly.
          </p>
        </div>

        <div className="lg:grid lg:grid-cols-[minmax(0,560px)_minmax(320px,1fr)] lg:items-start lg:gap-8">
          {/* Live preview — sticky left column on desktop */}
          <div className="flex flex-col gap-4 lg:sticky lg:top-6">
            <Card className="flex items-center gap-4 p-4 lg:flex-col lg:items-stretch lg:p-5">
              {/* Mobile: mini checkerboard swatch */}
              <div className="w-28 shrink-0 lg:hidden">
                <MiniBoard themeId={boardTheme} size={8} />
              </div>
              {/* Desktop: full board with pieces — live theme preview */}
              <div className="hidden w-full lg:block lg:max-w-md lg:self-center">
                <ChessBoard fen={START_FEN} interactive={false} showNotation />
              </div>
              <div className="min-w-0 flex-1 lg:text-center">
                <span className="rounded-pill bg-brand inline-block px-2 py-0.5 text-xs font-extrabold text-white">
                  Live preview
                </span>
                <p className="text-ink mt-1 truncate text-sm font-extrabold lg:text-base">
                  {getBoardTheme(boardTheme).name} board ·{" "}
                  {PIECE_THEMES.find((p) => p.id === pieceTheme)?.name ?? pieceTheme}{" "}
                  pieces
                </p>
                <Button
                  size="sm"
                  className="mt-2 lg:hidden"
                  onClick={() => setPreviewOpen(true)}
                >
                  Preview
                </Button>
              </div>
            </Card>
          </div>

          <div className="flex flex-col gap-5">
            {/* Full read-only board preview — mobile only (desktop uses sticky column) */}
            {previewOpen && (
              <div
                className="bg-ink/55 fixed inset-0 z-[80] flex items-center justify-center p-6 backdrop-blur-sm lg:hidden"
                onClick={() => setPreviewOpen(false)}
              >
                <div className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
                  <ChessBoard
                    fen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
                    interactive={false}
                    showNotation
                  />
                  <Button
                    block
                    className="mt-3"
                    variant="outline"
                    onClick={() => setPreviewOpen(false)}
                  >
                    Close preview
                  </Button>
                </div>
              </div>
            )}

            {/* App color themes */}
            <section>
              <h2 className="text-ink mb-2 text-sm font-extrabold">App theme</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {APP_THEMES.map((t) => {
                  const active = appTheme === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        set("appTheme", t.id);
                        haptics.fire("select");
                        audio.play("transition");
                      }}
                      className={`btn-tactile rounded-card flex items-center gap-2 border-2 p-2.5 ${
                        active
                          ? "border-brand bg-brand-50"
                          : "border-hairline bg-surface-card"
                      }`}
                    >
                      <span className="border-hairline flex h-8 w-8 shrink-0 overflow-hidden rounded-lg border">
                        <span className="w-1/3" style={{ background: t.swatch[0] }} />
                        <span className="w-1/3" style={{ background: t.swatch[1] }} />
                        <span className="w-1/3" style={{ background: t.swatch[2] }} />
                      </span>
                      <span className="min-w-0 flex-1 text-left">
                        <span className="text-ink flex items-center gap-1.5 truncate text-xs font-extrabold">
                          <ContentIcon emoji={t.emoji} size={16} variant="inline" />
                          {t.name}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Board themes */}
            <section>
              <h2 className="text-ink mb-2 text-sm font-extrabold">Board themes</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {SELECTABLE_BOARD_THEMES.map((id) => {
                  const active = boardTheme === id;
                  return (
                    <button
                      key={id}
                      onClick={() => {
                        set("boardTheme", id);
                        haptics.fire("select");
                        audio.play("transition");
                      }}
                      className={`btn-tactile rounded-card border-2 p-2 ${
                        active
                          ? "border-brand bg-brand-50"
                          : "border-hairline bg-surface-card"
                      }`}
                    >
                      <MiniBoard themeId={id} size={6} />
                      <p className="text-ink mt-1.5 truncate text-xs font-extrabold">
                        {BOARD_THEMES[id]!.name}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Piece sets — distinct silhouettes */}
            <section>
              <h2 className="text-ink mb-1 text-sm font-extrabold">Piece sets</h2>
              <p className="text-ink-500 mb-2 text-xs font-semibold">
                Fairytale uses flat storybook silhouettes — mice, castles, princesses,
                and more.
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {PIECE_THEMES.map((p) => {
                  const active = pieceTheme === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        set("pieceTheme", p.id as PieceTheme);
                        haptics.fire("select");
                        audio.play("transition");
                      }}
                      className={`btn-tactile rounded-card flex min-w-[5.5rem] flex-col items-center gap-1.5 border-2 p-3 ${
                        active
                          ? "border-brand bg-brand-50"
                          : "border-hairline bg-surface-card"
                      }`}
                    >
                      <div className="bg-surface-sunken w-full rounded-lg px-2 py-2">
                        <PiecePreview themeId={p.id} />
                      </div>
                      <p className="text-ink w-full truncate text-center text-xs font-extrabold">
                        {p.name}
                      </p>
                      <p className="text-ink-500 w-full truncate text-center text-[10px] font-semibold">
                        {p.family}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* School themes — identity layered on app theme */}
            <section>
              <h2 className="text-ink mb-1 text-sm font-extrabold">School theme</h2>
              <p className="text-ink-500 mb-2 text-xs font-semibold">
                Brand colors and campus styling — works together with your app theme
                above.
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {SCHOOL_THEMES.map((t) => {
                  const active = schoolTheme === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        set("schoolTheme", t.id);
                        haptics.fire("select");
                        audio.play("transition");
                      }}
                      className={`btn-tactile school-chrome-card flex flex-col items-center gap-1 border-2 p-3 ${
                        active
                          ? "border-brand bg-brand-50"
                          : "border-hairline bg-surface-card"
                      }`}
                    >
                      <ContentIcon emoji={t.emoji} size={24} selected={active} />
                      <span className="text-ink truncate text-xs font-extrabold">
                        {t.name}
                      </span>
                      <span className="text-ink-500 line-clamp-2 text-center text-[10px] leading-tight font-semibold">
                        {t.chrome}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
