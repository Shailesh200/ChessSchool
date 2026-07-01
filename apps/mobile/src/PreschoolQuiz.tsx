import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import LottieView from "lottie-react-native";
import { PreschoolQuizVisual, type PreschoolVisual } from "./PreschoolQuizVisual";
import { formatCoachText } from "@chess-school/progression";
import { haptics } from "./haptics";
import { sfx } from "./sfx";
import { colors, font, radius, shadowCard, space, type } from "./theme";

export type QuizOption = { label: string; emoji?: string };

export type QuizStep = {
  id: string;
  coach: string;
  question?: string;
  options?: QuizOption[];
  correct?: number;
  explain?: string;
  failText?: string;
  successText?: string;
  visual?: PreschoolVisual;
  visualSquare?: string;
  visualSquares?: [string, string];
};

const LETTERS = "ABCDEF";

const styles = StyleSheet.create({
  root: { width: "100%", gap: space[3], paddingHorizontal: space[2] },
  sparkle: { position: "absolute", top: -16, alignSelf: "center", zIndex: 2 },
  lottie: { width: 60, height: 60 },
  questionCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surfaceCard,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    ...shadowCard,
  },
  sectionLabel: {
    fontFamily: font.bold,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.brand,
    marginBottom: space[1.5],
  },
  sectionLabelMuted: {
    fontFamily: font.bold,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.ink500,
    marginBottom: space[2],
  },
  question: { ...type.sm, fontFamily: font.bold, color: colors.ink },
  answersSection: { width: "100%" },
  options: { gap: space[2] },
  option: {
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: colors.hairline,
    backgroundColor: colors.surfaceCard,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    ...shadowCard,
  },
  optionInner: { gap: space[1.5] },
  optionTopRow: { flexDirection: "row", alignItems: "center", gap: space[2] },
  letterBadge: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    backgroundColor: colors.brand50,
    alignItems: "center",
    justifyContent: "center",
  },
  letterText: { fontFamily: font.bold, ...type.xs, color: colors.brand },
  optionSel: { borderColor: colors.brand, backgroundColor: colors.brand50 },
  optionOk: { borderColor: colors.success, backgroundColor: "rgba(52,211,153,0.12)" },
  optionBad: { borderColor: colors.danger, backgroundColor: "rgba(207,67,36,0.1)" },
  optEmoji: { fontSize: 18, lineHeight: 20 },
  optLabel: {
    fontFamily: font.bold,
    ...type.sm,
    color: colors.ink,
    paddingLeft: 28,
  },
  check: { fontSize: 16, color: colors.success },
  explain: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: "rgba(52,211,153,0.35)",
    backgroundColor: "rgba(52,211,153,0.12)",
    padding: space[3],
  },
  explainLabel: {
    fontFamily: font.bold,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.success600,
    marginBottom: space[1.5],
  },
  explainText: { ...type.sm, fontFamily: font.semibold, color: colors.ink },
});

export function PreschoolQuiz({
  step,
  phase,
  onAnswer,
}: {
  step: QuizStep;
  phase: "playing" | "correct" | "wrong";
  onAnswer: (correct: boolean) => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const shake = useRef(new Animated.Value(0)).current;
  const lottieRef = useRef<LottieView>(null);
  const options = step.options ?? [];
  const correctIdx = step.correct ?? 0;

  useEffect(() => {
    setPicked(null);
  }, [step.id]);

  useEffect(() => {
    if (phase === "correct") lottieRef.current?.play();
  }, [phase]);

  function runShake() {
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 6, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }

  function pick(i: number) {
    if (phase === "correct" || picked !== null) return;
    setPicked(i);
    const ok = i === correctIdx;
    if (ok) {
      sfx.play("success");
      haptics.success();
      onAnswer(true);
      return;
    }
    sfx.play("fail");
    haptics.error();
    runShake();
    setTimeout(() => {
      setPicked(null);
      onAnswer(false);
    }, 900);
  }

  return (
    <Animated.View style={[styles.root, { transform: [{ translateX: shake }] }]}>
      {phase === "correct" && (
        <View style={styles.sparkle} pointerEvents="none">
          <LottieView
            ref={lottieRef}
            source={require("../assets/lottie/splash-logo.json")}
            autoPlay={false}
            loop={false}
            style={styles.lottie}
          />
        </View>
      )}

      <PreschoolQuizVisual visual={step.visual} visualSquare={step.visualSquare} visualSquares={step.visualSquares} />

      {/* Question block */}
      <View style={styles.questionCard}>
        <Text style={styles.sectionLabel}>Question</Text>
        <Text style={styles.question}>{step.question}</Text>
      </View>

      {/* Answers — separate section below */}
      <View style={styles.answersSection}>
        <Text style={styles.sectionLabelMuted}>Choose your answer</Text>
        <View style={styles.options}>
          {options.map((opt, i) => {
            const selected = picked === i;
            const isCorrect = i === correctIdx;
            const reveal = phase === "correct" && picked !== null;
            const hot = reveal && isCorrect;
            const bad = reveal && selected && !isCorrect;

            return (
              <Pressable
                key={`${step.id}-${i}`}
                disabled={phase === "correct" || (picked !== null && picked !== i)}
                onPress={() => pick(i)}
                style={[
                  styles.option,
                  hot && styles.optionOk,
                  bad && styles.optionBad,
                  selected && !reveal && styles.optionSel,
                ]}
              >
                <View style={styles.optionInner}>
                  <View style={styles.optionTopRow}>
                    <View style={styles.letterBadge}>
                      <Text style={styles.letterText}>{LETTERS[i]}</Text>
                    </View>
                    {opt.emoji ? <Text style={styles.optEmoji}>{opt.emoji}</Text> : null}
                    {hot ? <Text style={[styles.check, { marginLeft: "auto" }]}>✓</Text> : null}
                  </View>
                  <Text style={styles.optLabel}>{opt.label}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      {phase === "correct" && step.explain ? (
        <View style={styles.explain}>
          <Text style={styles.explainLabel}>Answer</Text>
          <Text style={styles.explainText}>{formatCoachText(step.explain)}</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}
