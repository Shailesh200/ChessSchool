"use client";

import { PIECE_SETS } from "@chessschool/chess";
import { APP_ICONS, copy, palettes, resolveTheme, THEMES, type Appearance } from "@chessschool/design";
import { PieceArt } from "@/components/Board";
import { Card, Segmented, Switch, TopBar } from "@/components/ui";
import { useApp } from "@/lib/state";

export default function LooksPage() {
  const { state, ready, setPrefs, cue } = useApp();
  if (!ready) return <div className="page-skeleton" aria-busy="true" />;
  const { prefs } = state;
  const s = copy.settings;
  const pick = (p: Partial<typeof prefs>) => {
    cue("tap");
    setPrefs(p);
  };

  return (
    <div className="page page-narrow">
      <TopBar backHref="/you" title={copy.looks.title} />

      <Card>
        <h2 className="card-title">{copy.looks.theme}</h2>
        <div className="swatches" role="radiogroup" aria-label={copy.looks.theme}>
          {THEMES.map((t) => {
            const p = t.id === "classroom" ? palettes.light : resolveTheme(t.id, "light", false).palette;
            return (
              <button key={t.id} type="button" role="radio" aria-checked={prefs.theme === t.id} className="swatch" onClick={() => pick({ theme: t.id })}>
                <span className="swatch-art" style={{ background: p.bg, borderColor: p.line }} aria-hidden>
                  <span style={{ background: p.brand }} />
                  <span style={{ background: p.boardLight }} />
                  <span style={{ background: p.boardDark }} />
                  <span style={{ background: p.accent }} />
                </span>
                <strong>{t.name}</strong>
                <span>{t.blurb}</span>
              </button>
            );
          })}
        </div>
        {prefs.theme === "classroom" ? (
          <div className="row-block">
            <Segmented<Appearance>
              label={s.appearance}
              value={prefs.appearance}
              onChange={(a) => pick({ appearance: a })}
              options={(["system", "light", "dark"] as const).map((v) => ({ value: v, label: s.appearanceOptions[v] }))}
            />
          </div>
        ) : null}
      </Card>

      <Card>
        <h2 className="card-title">{copy.looks.pieces}</h2>
        <div className="sets" role="radiogroup" aria-label={copy.looks.pieces}>
          {PIECE_SETS.map((set) => (
            <button key={set.id} type="button" role="radio" aria-checked={prefs.pieceSet === set.id} className="set-card" onClick={() => pick({ pieceSet: set.id })}>
              <span className="set-preview" aria-hidden>
                <span className="sq-light">
                  <PieceArt piece={{ type: "n", color: "w" }} set={set.id} />
                </span>
                <span className="sq-dark">
                  <PieceArt piece={{ type: "q", color: "b" }} set={set.id} />
                </span>
              </span>
              <strong>{set.name}</strong>
              <span>{set.blurb}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card className="settings-group">
        <h2 className="card-title">{copy.looks.board}</h2>
        <Switch icon="doc" label={copy.looks.coords} checked={prefs.coords} onChange={(v) => setPrefs({ coords: v })} />
        <Switch icon="eye" label={copy.looks.legalDots} checked={prefs.legalDots} onChange={(v) => setPrefs({ legalDots: v })} />
        <Switch icon="star" label={copy.gym.promotion} hint={copy.gym.promotionHint} checked={prefs.promotion === "ask"} onChange={(v) => setPrefs({ promotion: v ? "ask" : "queen" })} />
      </Card>

      <Card>
        <h2 className="card-title">{copy.looks.icon}</h2>
        <p className="muted">{copy.looks.iconUnavailable}</p>
        <div className="icons" role="radiogroup" aria-label={copy.looks.icon}>
          {APP_ICONS.map((i) => (
            <button key={i.id} type="button" role="radio" aria-checked={prefs.appIcon === i.id} className="icon-choice" onClick={() => pick({ appIcon: i.id })}>
              {/* eslint-disable-next-line @next/next/no-img-element -- small local previews */}
              <img src={`/assets/raster/app-icons/${i.id}-preview.png`} alt="" width={64} height={64} />
              <span>{i.name}</span>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
