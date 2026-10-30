import { StyleSheet } from "react-native";
import type { PremiumThemeTokens } from "@/theme/premium";
import tokens from "@/theme/premium/tokens.json";

export const PREMIUM_COLUMN = { maxWidth: 390, width: "100%" as const, alignSelf: "center" as const };

type ColorMode = "light" | "dark";

function semantic(mode: ColorMode) {
  return tokens.semantic[mode];
}

/** Auth / onboarding typography and fields aligned to dex kit tokens. */
export function createPremiumAuthStyles(t: PremiumThemeTokens, mode: ColorMode = "light") {
  const { colors, space, radius, type, font } = t;
  const sem = semantic(mode);
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    wrap: { padding: space["5"], gap: space["4"], paddingBottom: space["8"] },
    logoFrame: {
      alignSelf: "center",
      backgroundColor: colors.brand100,
      borderRadius: radius.xl,
      paddingHorizontal: space["5"],
      paddingVertical: space["3"],
    },
    h1: { fontSize: type.h1.fontSize, lineHeight: type.h1.lineHeight, fontFamily: font.displayBold, color: colors.ink },
    h2: {
      fontSize: type.h2.fontSize,
      lineHeight: type.h2.lineHeight,
      fontFamily: font.displayBold,
      color: colors.ink,
      textAlign: "center",
    },
    muted: { fontSize: type.body.fontSize, lineHeight: type.body.lineHeight, fontFamily: font.uiMedium, color: colors.ink500 },
    field: { gap: 6 },
    label: { fontSize: type.body.fontSize, lineHeight: type.body.lineHeight, fontFamily: font.uiBold, color: colors.ink },
    input: {
      minHeight: 56,
      borderRadius: radius.lg,
      borderWidth: 1.5,
      borderColor: colors.lineStrong,
      backgroundColor: colors.surfaceCard,
      paddingHorizontal: space["4"],
      fontSize: 16,
      fontFamily: font.uiMedium,
      color: colors.ink,
    },
    inputBad: { borderColor: colors.danger, borderWidth: 2 },
    help: { fontSize: type.caption.fontSize, lineHeight: type.caption.lineHeight, fontFamily: font.uiMedium, color: colors.ink500 },
    helpCenter: {
      fontSize: type.caption.fontSize,
      lineHeight: type.caption.lineHeight,
      fontFamily: font.uiMedium,
      color: colors.ink500,
      textAlign: "center",
    },
    link: { color: colors.textLink, fontFamily: font.uiBold, fontSize: 16 },
    errInline: { color: colors.danger, fontFamily: font.uiBold, textAlign: "center" },
    alert: {
      backgroundColor: sem["error-soft"],
      borderRadius: radius.md,
      padding: space["3"],
    },
    alertText: { color: sem["error-text"], fontFamily: font.uiBold },
    divider: { flexDirection: "row", alignItems: "center", gap: space["3"] },
    line: { flex: 1, height: 1.5, backgroundColor: colors.hairline },
    or: { fontFamily: font.uiBold, color: colors.ink500, fontSize: 14 },
    foot: { flexDirection: "row", justifyContent: "center", gap: 6, flexWrap: "wrap" },
    forgot: { alignSelf: "flex-end" },
    legal: { textAlign: "center", marginTop: space["2"] },
    center: { textAlign: "center" },
    sentMain: {
      fontSize: type.body.fontSize,
      lineHeight: type.body.lineHeight,
      fontFamily: font.uiMedium,
      color: colors.ink,
      textAlign: "center",
    },
    sentBold: { fontFamily: font.uiBold },
    sentBox: {
      backgroundColor: colors.brand100,
      borderRadius: radius.x2,
      paddingVertical: 20,
      paddingHorizontal: space["4"],
      alignItems: "center",
      gap: space["2"],
    },
    sentIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.surfaceCard,
      alignItems: "center",
      justifyContent: "center",
    },
    alertWarn: {
      flexDirection: "row",
      gap: space["3"],
      alignItems: "flex-start",
      backgroundColor: sem["warning-soft"] ?? tokens.color.sun["200"],
      borderRadius: radius.lg,
      padding: space["4"],
    },
    alertWarnText: { flex: 1, color: sem["warning-text"] ?? tokens.color.sun["800"], fontFamily: font.uiBold, fontSize: 15 },
  });
}

export function createSplashStyles(t: PremiumThemeTokens) {
  const { colors, space, radius, type, font } = t;
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg, ...PREMIUM_COLUMN },
    inner: { flex: 1, padding: space["5"], gap: space["5"], justifyContent: "center" },
    hero: {
      backgroundColor: colors.brand100,
      borderRadius: radius.x2,
      paddingVertical: space["10"],
      alignItems: "center",
    },
    act: { gap: space["3"], alignItems: "center" },
    h1: {
      fontSize: type.h1.fontSize,
      lineHeight: type.h1.lineHeight,
      fontFamily: font.displayBold,
      color: colors.ink,
      textAlign: "center",
      maxWidth: 340,
    },
    sub: {
      fontSize: type["body-lg"].fontSize,
      lineHeight: type["body-lg"].lineHeight,
      fontFamily: font.uiMedium,
      color: colors.ink500,
      textAlign: "center",
      maxWidth: 340,
    },
    btns: { width: "100%", maxWidth: 390, gap: space["2"], marginTop: space["2"] },
    tag: {
      fontSize: type.h2.fontSize,
      lineHeight: type.h2.lineHeight,
      fontFamily: font.displayBold,
      color: colors.ink,
      textAlign: "center",
    },
  });
}

export function createStepDotStyles(t: PremiumThemeTokens) {
  const { colors, radius } = t;
  return StyleSheet.create({
    row: { flexDirection: "row", justifyContent: "center", gap: 6, marginVertical: 4 },
    dot: { width: 8, height: 8, borderRadius: radius.pill, backgroundColor: colors.lineStrong },
    on: { backgroundColor: colors.accent },
    done: { backgroundColor: colors.brand },
  });
}

export function createOptionListStyles(t: PremiumThemeTokens) {
  const { colors, space, radius, type, font } = t;
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: space["3"],
      backgroundColor: colors.surfaceCard,
      borderWidth: 1.5,
      borderColor: colors.hairline,
      borderRadius: radius.xl,
      paddingVertical: 14,
      paddingHorizontal: space["4"],
      marginBottom: space["2"],
    },
    rowOn: {
      borderColor: colors.brand,
      backgroundColor: colors.brand100,
      shadowColor: colors.brand700,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 0,
    },
    icon: {
      width: 40,
      height: 40,
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    iconOn: { backgroundColor: colors.surfaceCard },
    text: { flex: 1, minWidth: 0 },
    title: { fontSize: type.body.fontSize, lineHeight: type.body.lineHeight, fontFamily: font.uiBold, color: colors.ink },
    titleOn: { color: colors.brand700 },
    sub: {
      fontSize: type.caption.fontSize,
      lineHeight: type.caption.lineHeight,
      fontFamily: font.uiMedium,
      color: colors.ink500,
      marginTop: 2,
    },
    subOn: { color: colors.brand700 },
    radio: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.lineStrong,
      alignItems: "center",
      justifyContent: "center",
    },
    radioOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  });
}

export function createPlayHubStyles(t: PremiumThemeTokens) {
  const { colors, space, radius, type, font } = t;
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg, maxWidth: 390, width: "100%", alignSelf: "center" },
    scroll: { padding: space["4"], paddingBottom: 120, gap: space["3"] },
    pageTitle: { fontSize: type.h1.fontSize, lineHeight: type.h1.lineHeight, fontFamily: font.displayBold, color: colors.ink },
    hero: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.brand100,
      borderRadius: radius.xl,
      padding: space["4"],
      gap: space["3"],
    },
    heroCopy: { flex: 1, gap: 4 },
    heroKicker: { fontSize: 12, fontFamily: font.uiBold, color: colors.ink500, textTransform: "uppercase" },
    heroTitle: { fontSize: 22, fontFamily: font.displayBold, color: colors.ink },
    heroSub: { fontSize: 14, fontFamily: font.uiMedium, color: colors.ink500 },
    heroArt: {
      width: 88,
      height: 88,
      borderRadius: radius.lg,
      backgroundColor: colors.brand100,
      alignItems: "center",
      justifyContent: "flex-end",
      overflow: "hidden",
    },
    bust: { width: 80, height: 80, resizeMode: "contain" },
    section: { fontSize: 20, fontFamily: font.displayBold, color: colors.ink },
    modes: { gap: space["2"] },
    mode: {
      flexDirection: "row",
      alignItems: "center",
      gap: space["3"],
      padding: space["3"],
      borderRadius: radius.lg,
      borderWidth: 1.5,
      borderColor: colors.hairline,
      backgroundColor: colors.surfaceCard,
    },
    modeOn: { borderColor: colors.brand, backgroundColor: colors.brand100 },
    modeIcon: {
      width: 40,
      height: 40,
      borderRadius: radius.sm,
      backgroundColor: colors.brand100,
      alignItems: "center",
      justifyContent: "center",
    },
    modeText: { flex: 1 },
    modeTitle: { fontFamily: font.uiBold, fontSize: 16, color: colors.ink },
    modeSub: { fontFamily: font.uiMedium, fontSize: 13, color: colors.ink500, marginTop: 2 },
    oppoList: { gap: space["2"] },
    opp: {
      flexDirection: "row",
      alignItems: "center",
      gap: space["3"],
      padding: space["3"],
      borderRadius: radius.lg,
      borderWidth: 1.5,
      borderColor: colors.hairline,
      backgroundColor: colors.surfaceCard,
    },
    oppOn: { borderColor: colors.brand, borderWidth: 2 },
    oppText: { flex: 1 },
    oppName: { fontFamily: font.uiBold, fontSize: 16, color: colors.ink },
    oppDesc: { fontFamily: font.uiMedium, fontSize: 13, color: colors.ink500, marginTop: 2 },
    pill: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
    pill_easy: { backgroundColor: colors.brand100 },
    pill_medium: { backgroundColor: tokens.color.sun["200"] },
    pill_hard: { backgroundColor: tokens.color.coral["200"] },
    pillText: { fontFamily: font.uiBold, fontSize: 12, color: colors.ink },
    ashRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: space["3"],
      padding: space["3"],
      borderRadius: radius.lg,
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: colors.lineStrong,
    },
    toggle: { width: 48, height: 28, borderRadius: 14, backgroundColor: colors.hairline, padding: 3 },
    toggleOn: { backgroundColor: colors.brand },
    knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.surfaceCard },
    knobOn: { alignSelf: "flex-end" },
    startBar: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: space["3"],
      padding: space["4"],
      paddingBottom: space["5"],
      backgroundColor: colors.surfaceCard,
      borderTopWidth: 1.5,
      borderTopColor: colors.hairline,
    },
    startCopy: { flex: 1 },
    startTitle: { fontFamily: font.uiBold, fontSize: 15, color: colors.ink },
    startSub: { fontFamily: font.uiMedium, fontSize: 13, color: colors.ink500 },
    startBtn: { minWidth: 130 },
  });
}

export function createPasswordFieldStyles(t: PremiumThemeTokens, mode: ColorMode = "light") {
  const { colors, space, radius, type, font } = t;
  const sem = semantic(mode);
  return StyleSheet.create({
    field: { gap: 6 },
    label: { fontSize: type.body.fontSize, lineHeight: type.body.lineHeight, fontFamily: font.uiBold, color: colors.ink },
    inpRow: { position: "relative" },
    input: {
      minHeight: 56,
      borderRadius: radius.lg,
      borderWidth: 1.5,
      borderColor: colors.lineStrong,
      backgroundColor: colors.surfaceCard,
      paddingHorizontal: space["4"],
      paddingRight: 48,
      fontSize: 16,
      fontFamily: font.uiMedium,
      color: colors.ink,
    },
    inputBad: { borderColor: colors.danger, borderWidth: 2 },
    eye: { position: "absolute", right: 8, top: 8, width: 40, height: 40, alignItems: "center", justifyContent: "center" },
    pwm: { flexDirection: "row", gap: 4, marginTop: 4 },
    bar: { flex: 1, height: 8, borderRadius: 99, backgroundColor: colors.hairline },
    l1: { backgroundColor: colors.danger },
    l2: { backgroundColor: colors.gold },
    l3: { backgroundColor: colors.success },
    pwmT: { fontSize: 13, fontFamily: font.uiBold, color: colors.ink500 },
    rule: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
    ruleDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.ink500 },
    ruleText: { fontSize: 13, fontFamily: font.uiMedium, color: colors.ink500 },
    ruleOk: { color: sem["success-text"] ?? colors.brand700, fontFamily: font.uiBold },
    msg: {
      flexDirection: "row",
      gap: 8,
      alignItems: "flex-start",
      backgroundColor: sem["error-soft"],
      borderRadius: radius.sm,
      padding: space["2"],
    },
    msgText: { flex: 1, color: sem["error-text"], fontFamily: font.uiBold, fontSize: 14 },
  });
}
