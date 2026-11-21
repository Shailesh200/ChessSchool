"use client";

import { PIECE_SETS } from "@chessschool/chess";
import { APP_ICONS, type Appearance, BOARD_COLORS, copy, lockedUntil, palettes, resolveTheme, type RewardKind, THEMES, withBoardColors } from "@chessschool/design";
import { PieceArt } from "@/components/Board";
import { Icon } from "@/components/Icon";
import { Card, Segmented, Switch, TopBar, useToast } from "@/components/ui";
import { useMediaQuery } from "@/lib/hooks";
import { useApp } from "@/lib/state";

export default function LooksPage() {
  const { state, ready, setPrefs, cue } = useApp();
  const toast = useToast();
  const systemDark = useMediaQuery("(prefers-color-scheme: dark)");
  if (!ready) return <div className="page-skeleton" aria-busy="true" />;
  const { prefs } = state;
  const s = copy.settings;
  const pick = (p: Partial<typeof prefs>) => {
    cue("tap");
    setPrefs(p);
  };
  /** Quest rewards stay locked until enough quest days; a click explains how to unlock them. */
  const locked = (kind: RewardKind, id: string, p: Partial<typeof prefs>) => {
    const need = lockedUntil(state, kind, id);
    return {
      className: need ? " is-locked" : "",
      disabled: need ? true : undefined,
      onClick: () => (need ? toast(copy.quests.locked(need)) : pick(p)),
      note: need ? (
        <span className="lock-note">
          <Icon name="lock" size={14} /> {copy.quests.locked(need)}
        </span>
      ) : null,
    };
  };

  return (
    <div className="page page-narrow">
      <TopBar backHref="/you" title={copy.looks.title} />

      <Card>
        <h2 className="card-title">{copy.looks.theme}</h2>
        <div className="swatches" role="radiogroup" aria-label={copy.looks.theme}>
          {THEMES.map((t) => {
            const p = t.id === "classroom" ? palettes.light : resolveTheme(t.id, "light", false).palette;
            const l = locked("theme", t.id, { theme: t.id });
            return (
              <button key={t.id} type="button" role="radio" aria-checked={prefs.theme === t.id} aria-disabled={l.disabled} className={`swatch${l.className}`} onClick={l.onClick}>
                <span className="swatch-art" style={{ background: p.bg, borderColor: p.line }} aria-hidden>
                  <span style={{ background: p.brand }} />
                  <span style={{ background: p.boardLight }} />
                  <span style={{ background: p.boardDark }} />
                  <span style={{ background: p.accent }} />
                </span>
                <strong>{t.name}</strong>
                <span>{t.blurb}</span>
                {l.note}
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
          {PIECE_SETS.map((set) => {
            const l = locked("pieces", set.id, { pieceSet: set.id });
            return (
              <button key={set.id} type="button" role="radio" aria-checked={prefs.pieceSet === set.id} aria-disabled={l.disabled} className={`set-card${l.className}`} onClick={l.onClick}>
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
                {l.note}
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="settings-group">
        <h2 className="card-title">{copy.looks.board}</h2>
        <div className="swatches row-block" role="radiogroup" aria-label={copy.looks.boardColors}>
          {BOARD_COLORS.map((id) => {
            const b = withBoardColors(resolveTheme(prefs.theme, prefs.appearance, systemDark).palette, id);
            const o = copy.looks.boardColorOptions[id];
            return (
              <button key={id} type="button" role="radio" aria-checked={prefs.boardColors === id} className="swatch" onClick={() => pick({ boardColors: id })}>
                <span className="swatch-art swatch-board" aria-hidden>
                  <span style={{ background: b.boardLight }} />
                  <span style={{ background: b.boardDark }} />
                  <span style={{ background: b.boardLight }} />
                  <span style={{ background: b.boardDark }} />
                </span>
                <strong>{o.name}</strong>
                <span>{o.blurb}</span>
              </button>
            );
          })}
        </div>
        <Switch icon="doc" label={copy.looks.coords} checked={prefs.coords} onChange={(v) => setPrefs({ coords: v })} />
        <Switch icon="eye" label={copy.looks.legalDots} checked={prefs.legalDots} onChange={(v) => setPrefs({ legalDots: v })} />
        <Switch icon="eye" label={copy.platform.marks.label} hint={copy.platform.marks.hint} checked={prefs.markShapes} onChange={(v) => setPrefs({ markShapes: v })} />
        <Switch icon="star" label={copy.gym.promotion} hint={copy.gym.promotionHint} checked={prefs.promotion === "ask"} onChange={(v) => setPrefs({ promotion: v ? "ask" : "queen" })} />
      </Card>

      <Card>
        <h2 className="card-title">{copy.looks.icon}</h2>
        <p className="muted">{copy.looks.iconUnavailable}</p>
        <div className="icons" role="radiogroup" aria-label={copy.looks.icon}>
          {APP_ICONS.map((i) => {
            const l = locked("icon", i.id, { appIcon: i.id });
            return (
              <button key={i.id} type="button" role="radio" aria-checked={prefs.appIcon === i.id} aria-disabled={l.disabled} className={`icon-choice${l.className}`} onClick={l.onClick}>
                {/* eslint-disable-next-line @next/next/no-img-element -- small local previews */}
                <img src={`/assets/raster/app-icons/${i.id}-preview.png`} alt="" width={64} height={64} />
                <span>{i.name}</span>
                {l.note}
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
