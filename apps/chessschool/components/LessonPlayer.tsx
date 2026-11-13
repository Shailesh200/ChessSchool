import { chooseMove, currentStep, hintSquares, parseUci, positionCue, runnerReduce, startRunner, type RunnerAction, type RunnerState, type Square, type Step } from "@chessschool/chess";
import { copy, type CodyAnimation } from "@chessschool/design";
import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useReducedMotion } from "@/lib/hooks";
import { useApp } from "@/lib/state";
import { useTheme } from "@/lib/theme";
import { Board } from "./Board";
import { BoardStage } from "./BoardStage";
import { Icon } from "./Icon";
import { Cody } from "./Lottie";
import { Options } from "./Options";
import { Button, IconButton, Steps, T } from "./ui";

/** Fixed chrome so a longer line, a choice, or the Continue button cannot move the board. */
const COACH_H = 72;
const STATUS_H = 40;
const CHOICE_H = 132;
const FOOTER_H = 76;
const TOP_H = 56;

function poseFor(s: RunnerState, step: Step | undefined): CodyAnimation {
  if (s.botThinking) return "thinking";
  if (s.gameOver?.kind === "checkmate") return s.gameOver.winner === "w" ? "celebrate" : "proud";
  if (s.feedback?.tone === "good") return "happy";
  if (s.feedback?.tone === "hint") return "oops";
  return step?.pose ?? "idle";
}

/** Split coach copy into single lines that fit the bubble. */
function coachLines(text: string, width: number): string[] {
  const chars = Math.max(16, Math.floor(width / 8));
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  if (!words[0]) return [""];
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && next.length > chars) {
      out.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}

function CoachLine({ text, width }: { text: string; width: number }) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const lines = useMemo(() => coachLines(text, width), [text, width]);
  const [i, setI] = useState(0);
  const at = Math.min(i, lines.length - 1);
  useEffect(() => {
    if (reduced || at >= lines.length - 1) return;
    const words = lines[at]?.split(/\s+/).length ?? 4;
    const t = setTimeout(() => setI((n) => n + 1), Math.min(4200, Math.max(1500, words * 360)));
    return () => clearTimeout(t);
  }, [at, lines, reduced]);
  return (
    <Pressable
      accessibilityRole="text"
      accessibilityLabel={text}
      accessibilityHint={lines.length > 1 ? copy.lesson.moreLine : undefined}
      onPress={() => setI((n) => (n + 1) % lines.length)}
      style={{ minHeight: 24, justifyContent: "center" }}
    >
      <T role="body" color="textMuted" numberOfLines={1} style={{ color: c.textMuted }}>
        {lines[at]}
      </T>
    </Pressable>
  );
}

type Props = {
  steps: Step[];
  onClose: () => void;
  closeLabel?: string;
  onFinished: (misses: number) => void;
  done: React.ReactNode;
};

export function LessonPlayer({ steps, onClose, closeLabel = copy.lesson.close, onFinished, done }: Props) {
  const { cue } = useApp();
  const { c } = useTheme();
  const { width: screen } = useWindowDimensions();
  const [s, setS] = useState(() => startRunner(steps));
  // Mirrors `s` for handlers and timers, so cues fire from one place.
  const ref = useRef(s);
  const finished = useRef(false);
  const step = currentStep(s);
  const textW = Math.min(screen, 640) - 24 - COACH_H - 28;

  const act = (a: RunnerAction) => {
    const prev = ref.current;
    const next = runnerReduce(prev, a);
    if (next === prev) return;
    ref.current = next;
    setS(next);
    if (next.misses > prev.misses) cue("gentle-no");
    else if (next.status === "ready" && prev.status !== "ready") cue("success");
    else if (next.fen !== prev.fen) cue(positionCue(prev.fen, next.fen, next.lastMove));
    if (next.feedback && next.feedback !== prev.feedback) AccessibilityInfo.announceForAccessibility(next.feedback.text);
    if (next.status === "finished" && !finished.current) {
      finished.current = true;
      onFinished(next.misses);
    }
  };

  useEffect(() => {
    if (!s.botThinking) return;
    const t = setTimeout(() => {
      // Line steps play their scripted reply; game steps ask Cody.
      const cur = ref.current;
      const scripted = step?.kind === "line" ? parseUci(step.moves[cur.lineStep] ?? "") : null;
      const m = scripted ?? chooseMove(cur.fen, step?.kind === "game" ? step.level : "cody");
      if (m) act({ type: "bot", move: { from: m.from as Square, to: m.to as Square } });
    }, 650);
    return () => clearTimeout(t);
    // act reads the latest state through the ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.botThinking, s.fen]);

  const total = steps.length;
  const top = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, height: TOP_H }}>
      {s.status === "finished" ? <View style={{ width: 48 }} /> : <IconButton icon="close" label={closeLabel} onPress={onClose} />}
      <Steps count={total} current={s.status === "finished" ? total - 1 : s.index} label={copy.lesson.progress(Math.min(s.index + 1, total), total)} />
      <View style={{ width: 48 }} />
    </View>
  );

  if (s.status === "finished") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
        {top}
        <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 20, gap: 14 }}>{done}</ScrollView>
      </SafeAreaView>
    );
  }
  if (!step) return null;

  const interactive = step.kind !== "say";
  const canEnd = step.kind === "game" && s.gameMoves >= step.minMoves && !s.botThinking && s.status === "working";
  const status =
    step.kind === "stars" && s.status === "working"
      ? copy.lesson.starsLeft(s.stars.length)
      : step.kind === "game" && s.status === "working"
        ? s.botThinking
          ? copy.lesson.thinking
          : copy.lesson.yourMove
        : null;
  const action =
    s.status === "ready" ? (
      <Button title={copy.lesson.next} icon="arrowRight" onPress={() => act({ type: "next" })} />
    ) : canEnd ? (
      <Button title={copy.lesson.endGame} icon="flag" variant="secondary" onPress={() => act({ type: "endGame" })} />
    ) : interactive && step.kind !== "game" && s.status === "working" && !s.showHint ? (
      <Button title={copy.lesson.hint} icon="bulb" variant="ghost" onPress={() => act({ type: "hint" })} />
    ) : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      {top}
      <View style={{ flex: 1, minHeight: 0, paddingHorizontal: 12, gap: 10, maxWidth: 640, width: "100%", alignSelf: "center" }}>
        <BoardStage
          fixed
          topSize={COACH_H}
          bottomSize={STATUS_H}
          top={
            <>
              <Cody animation={poseFor(s, step)} size={64} />
              <View style={{ flex: 1, justifyContent: "center" }}>
                <T role="heading" header numberOfLines={1}>
                  {step.title}
                </T>
                <CoachLine key={`${s.index}:${step.body}`} text={step.body} width={textW} />
              </View>
            </>
          }
          bottom={
            <View accessibilityLiveRegion="polite" style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: c.brandSoft }}>
                <Icon name="profile" color={c.brandText} size={18} />
              </View>
              <T role="label" numberOfLines={1} style={{ flex: 1, color: s.feedback ? (s.feedback.tone === "good" ? c.successText : c.goldText) : c.textMuted }}>
                {s.feedback ? s.feedback.text : (status ?? (step.kind === "game" ? copy.lesson.endGameHint(step.minMoves) : ""))}
              </T>
              {s.feedback ? <Icon name={s.feedback.tone === "good" ? "check" : "bulb"} color={s.feedback.tone === "good" ? c.successText : c.goldText} /> : null}
            </View>
          }
        >
          {(size, radius) => (
            <Board
              size={size}
              radius={radius}
              fen={s.fen}
              selected={step.kind === "tap" ? (s.status === "ready" ? s.selected : null) : s.selected}
              targets={s.targets}
              lastMove={s.lastMove}
              check={s.check}
              highlight={step.highlight}
              hints={hintSquares(s)}
              stars={s.stars}
              onTap={(sq) => act({ type: "tap", square: sq })}
              disabled={!interactive || step.kind === "choice" || s.status !== "working" || s.botThinking}
              shake={s.misses}
              mate={s.gameOver?.kind === "checkmate" ? s.check : null}
              promotion={s.promotion}
              onPromote={(p) => act(p ? { type: "promote", piece: p } : { type: "cancelPromotion" })}
            />
          )}
        </BoardStage>

        <View style={{ height: CHOICE_H, justifyContent: "center", overflow: "hidden" }}>
          {step.kind === "choice" ? (
            <Options<string>
              label={step.body}
              columns={2}
              value={s.choice === null ? "" : String(s.choice)}
              onChange={(v) => {
                if (s.status !== "working") return;
                act({ type: "choose", index: Number(v) });
              }}
              options={step.options.map((o, i) => ({ value: String(i), title: o.label }))}
            />
          ) : null}
        </View>
      </View>
      <View style={{ height: FOOTER_H, justifyContent: "center", paddingHorizontal: 16, maxWidth: 560, width: "100%", alignSelf: "center" }}>{action}</View>
    </SafeAreaView>
  );
}
