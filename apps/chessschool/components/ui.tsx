import { copy, minTarget, radius, rankFor, RANKS, type IconName, type TypeRole, type, type Palette } from "@chessschool/design";
import { router } from "expo-router";
import { Cody } from "./Lottie";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, G, Line, Path, Text as SvgText } from "react-native-svg";
import { fonts, useTheme } from "@/lib/theme";
import { useConnectivity } from "@/lib/hooks";
import { useKeyboardScroll } from "@/lib/keyboard";
import { Icon } from "./Icon";

/* ---------- text ---------- */

type TProps = {
  role?: TypeRole;
  color?: keyof Palette;
  center?: boolean;
  style?: StyleProp<TextStyle>;
  children: React.ReactNode;
  header?: boolean;
  numberOfLines?: number;
};

export function T({ role = "body", color = "text", center, style, children, header, numberOfLines }: TProps) {
  const { c } = useTheme();
  const t = type[role];
  const big = role === "hero" || role === "title";
  return (
    <Text
      accessibilityRole={header ? "header" : undefined}
      maxFontSizeMultiplier={big ? 1.4 : 1.8}
      numberOfLines={numberOfLines}
      style={[{ fontFamily: fonts[t.weight], fontSize: t.size, lineHeight: t.line, color: c[color], textAlign: center ? "center" : undefined }, style]}
    >
      {children}
    </Text>
  );
}

/* ---------- buttons ---------- */

type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "gold" | "accent";
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  block?: boolean;
  hint?: string;
  /** Spoken label when it differs from the visible title (e.g. icon-only buttons). */
  label?: string;
  style?: StyleProp<ViewStyle>;
};

export function Button({ title, onPress, variant = "primary", icon, loading, disabled, block = true, hint, label, style }: ButtonProps) {
  const { c } = useTheme();
  const pal = {
    primary: { bg: c.brand, fg: c.onBrand, edge: c.brandEdge, border: "transparent" },
    secondary: { bg: c.card, fg: c.brandText, edge: c.line, border: c.line },
    ghost: { bg: "transparent", fg: c.brandText, edge: "transparent", border: "transparent" },
    danger: { bg: c.danger, fg: c.onDanger, edge: c.dangerText, border: "transparent" },
    gold: { bg: c.gold, fg: c.onGold, edge: c.goldEdge, border: "transparent" },
    accent: { bg: c.accent, fg: c.onAccent, edge: c.accentEdge, border: "transparent" },
  }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? title}
      accessibilityHint={hint}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={[block ? { alignSelf: "stretch" } : { alignSelf: "flex-start" }, style]}
    >
      {({ pressed }) => (
        <View style={{ paddingBottom: variant === "ghost" ? 0 : 5 }}>
          {variant !== "ghost" ? <View style={[StyleSheet.absoluteFill, { top: 5, borderRadius: radius.pill, backgroundColor: pal.edge }]} /> : null}
          <View
            style={{
              minHeight: minTarget,
              minWidth: title ? undefined : 56,
              paddingHorizontal: title ? 24 : 16,
              borderRadius: radius.pill,
              backgroundColor: pal.bg,
              borderWidth: variant === "secondary" ? 2 : 0,
              borderColor: pal.border,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              transform: [{ translateY: pressed && variant !== "ghost" ? 4 : 0 }],
              opacity: disabled ? 0.6 : pressed && variant === "ghost" ? 0.6 : 1,
            }}
          >
            {loading ? <ActivityIndicator color={pal.fg} /> : icon ? <Icon name={icon} color={pal.fg} size={22} /> : null}
            {title || loading ? (
              <T role="label" style={{ color: pal.fg, fontSize: 17 }}>
                {loading ? copy.auth.working : title}
              </T>
            ) : null}
          </View>
        </View>
      )}
    </Pressable>
  );
}

export function IconButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8} style={({ pressed }) => [s.iconBtn, pressed && { backgroundColor: c.sunken }]}>
      <Icon name={icon} color={c.text} />
    </Pressable>
  );
}

/* ---------- surfaces ---------- */

export function Card({ children, style, tone }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; tone?: "brand" | "success" | "hero" }) {
  const { c, scheme } = useTheme();
  const bg = tone === "brand" ? c.brandSoft : tone === "success" ? c.successSoft : tone === "hero" ? c.heroFrom : c.card;
  return (
    <View
      style={[
        {
          backgroundColor: bg,
          borderRadius: radius.lg,
          borderWidth: tone ? 0 : 1,
          borderColor: c.line,
          padding: 20,
          shadowColor: "#1C1B2E",
          shadowOpacity: scheme === "dark" ? 0 : 0.08,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
          elevation: scheme === "dark" ? 0 : 2,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Chip({ icon, tone = "neutral", children, label }: { icon?: IconName; tone?: "neutral" | "gold" | "accent" | "brand"; children: string; label?: string }) {
  const { c } = useTheme();
  const pal = {
    neutral: { bg: c.sunken, fg: c.text, ic: c.textMuted },
    gold: { bg: c.goldSoft, fg: c.goldText, ic: c.goldText },
    accent: { bg: c.dangerSoft, fg: c.text, ic: c.accent },
    brand: { bg: c.brandSoft, fg: c.brandText, ic: c.brandText },
  }[tone];
  return (
    <View accessible accessibilityLabel={label ?? children} style={[s.chip, { backgroundColor: pal.bg }]}>
      {icon ? <Icon name={icon} color={pal.ic} size={18} /> : null}
      <T role="small" style={{ color: pal.fg, fontFamily: fonts.semibold }}>
        {children}
      </T>
    </View>
  );
}

/* ---------- rows & controls ---------- */

export function Row({ icon, label, hint, onPress, right, danger, chevron }: { icon?: IconName; label: string; hint?: string; onPress?: () => void; right?: React.ReactNode; danger?: boolean; chevron?: boolean }) {
  const { c } = useTheme();
  const content = (pressed: boolean) => (
    <View style={[s.row, pressed && { backgroundColor: c.sunken, transform: [{ scale: 0.985 }] }]}>
      {icon ? <Icon name={icon} color={danger ? c.dangerText : c.textMuted} /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <T role="label" style={danger ? { color: c.dangerText } : undefined}>
          {label}
        </T>
        {hint ? (
          <T role="small" color="textMuted">
            {hint}
          </T>
        ) : null}
      </View>
      {right}
      {chevron ? <Icon name="chevron" color={c.textMuted} /> : null}
    </View>
  );
  if (!onPress) return <View accessible accessibilityLabel={hint ? `${label}. ${hint}` : label}>{content(false)}</View>;
  return (
    <Pressable accessibilityRole={chevron ? "link" : "button"} accessibilityLabel={label} accessibilityHint={hint} onPress={onPress}>
      {({ pressed }) => content(pressed)}
    </Pressable>
  );
}

export function SwitchRow({ icon, label, hint, value, onChange, disabled }: { icon?: IconName; label: string; hint?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const { c } = useTheme();
  const x = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(x, { toValue: value ? 1 : 0, duration: 180, useNativeDriver: true }).start();
  }, [value, x]);
  return (
    <Pressable accessibilityRole="switch" accessibilityLabel={label} accessibilityHint={hint} accessibilityState={{ checked: value, disabled }} disabled={disabled} onPress={() => onChange(!value)}>
      {({ pressed }) => (
        <View style={[s.row, pressed && { backgroundColor: c.sunken }, disabled && { opacity: 0.7 }]}>
          {icon ? <Icon name={icon} color={c.textMuted} /> : null}
          <View style={{ flex: 1, gap: 2 }}>
            <T role="label">{label}</T>
            {hint ? (
              <T role="small" color="textMuted">
                {hint}
              </T>
            ) : null}
          </View>
          <View style={[s.switch, { backgroundColor: value ? c.brand : c.line }]}>
            <Animated.View style={[s.knob, { transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, 20] }) }] }]} />
          </View>
        </View>
      )}
    </Pressable>
  );
}

export function Segmented<V extends string | number>({ value, options, onChange, label }: { value: V; options: { value: V; label: string }[]; onChange: (v: V) => void; label: string }) {
  const { c } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[s.seg, { backgroundColor: c.sunken }]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={o.label}
            onPress={() => onChange(o.value)}
            style={[s.segItem, on && { backgroundColor: c.card, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 }]}
          >
            <T role="label" style={{ color: on ? c.brandText : c.textMuted }}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Choice({ label, selected, onPress, tint }: { label: string; selected: boolean; onPress: () => void; tint?: string }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        s.choice,
        { backgroundColor: tint ?? c.card, borderColor: selected ? c.brand : c.line, transform: [{ scale: pressed ? 0.98 : 1 }] },
      ]}
    >
      <T role="bodyLg" style={{ flex: 1 }}>
        {label}
      </T>
      {selected ? <Icon name="check" color={c.brandText} /> : null}
    </Pressable>
  );
}

type FieldProps = { label: string; error?: string | null; hint?: string; password?: boolean; ref?: React.Ref<TextInput> } & TextInputProps;

export function TextField({ label, error, hint, password, ...rest }: FieldProps) {
  const { c } = useTheme();
  const [show, setShow] = useState(false);
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <T role="label">{label}</T>
      <View>
        <TextInput
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          placeholderTextColor={c.textSubtle}
          secureTextEntry={password && !show}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          maxFontSizeMultiplier={1.6}
          style={[
            s.input,
            {
              backgroundColor: c.card,
              color: c.text,
              fontFamily: fonts.medium,
              borderColor: error ? c.danger : focus ? c.brand : c.line,
              paddingRight: password ? 60 : 18,
            },
          ]}
          {...rest}
        />
        {password ? (
          <Pressable accessibilityRole="button" accessibilityLabel={show ? copy.auth.hide : copy.auth.show} onPress={() => setShow(!show)} style={s.eye} hitSlop={6}>
            <Icon name={show ? "eyeOff" : "eye"} color={c.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <T role="small" style={{ color: c.dangerText }}>
          {error}
        </T>
      ) : hint ? (
        <T role="small" color="textMuted">
          {hint}
        </T>
      ) : null}
    </View>
  );
}

/* ---------- sheet ---------- */

export function Sheet({ visible, onClose, children, scroll }: { visible: boolean; onClose: () => void; children: React.ReactNode; scroll?: boolean }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [drag] = useState(() => new Animated.Value(0));
  const close = useRef(onClose);
  close.current = onClose;
  const [pan] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_e, g) => drag.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_e, g) => {
        if (g.dy > 110 || g.vy > 1.1) {
          Animated.timing(drag, { toValue: 700, duration: 180, useNativeDriver: true }).start(() => close.current());
        } else {
          Animated.spring(drag, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
        }
      },
      onPanResponderTerminate: () => Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start(),
    }),
  );
  useEffect(() => {
    if (visible) drag.setValue(0);
  }, [visible, drag]);
  const body = scroll ? (
    <ScrollView style={{ alignSelf: "stretch" }} contentContainerStyle={{ gap: 12, alignItems: "center" }} showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    children
  );
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} onPress={onClose} accessibilityLabel={copy.a11y.closeSheet} accessibilityRole="button" />
      <View style={{ flex: 1, justifyContent: "flex-end" }} pointerEvents="box-none">
        <Animated.View accessibilityViewIsModal style={[s.sheet, { backgroundColor: c.card, paddingBottom: 22 + insets.bottom, maxHeight: "88%", transform: [{ translateY: drag }] }]}>
          <View {...pan.panHandlers} style={s.sheetGrip} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: c.line }} />
          </View>
          {body}
        </Animated.View>
      </View>
    </Modal>
  );
}

/* ---------- toast ---------- */

const ToastCtx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [msg, setMsg] = useState<string | null>(null);
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!msg) return;
    Animated.timing(y, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    const t = setTimeout(() => Animated.timing(y, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setMsg(null)), 3000);
    return () => clearTimeout(t);
  }, [msg, y]);
  const show = useCallback((m: string) => setMsg(m), []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg ? (
        <Animated.View
          accessibilityLiveRegion="polite"
          pointerEvents="none"
          style={[
            s.toast,
            { bottom: insets.bottom + 92, backgroundColor: c.text, opacity: y, transform: [{ translateY: y.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] },
          ]}
        >
          <T role="label" style={{ color: c.bg }} center>
            {msg}
          </T>
        </Animated.View>
      ) : null}
    </ToastCtx.Provider>
  );
}

/* ---------- screens ---------- */

export function Banner() {
  const { c } = useTheme();
  const { status, retry } = useConnectivity();
  if (status === "online") return null;
  return (
    <View accessibilityRole="alert" style={[s.banner, { backgroundColor: c.goldSoft }]}>
      <Icon name="wifiOff" color={c.goldText} />
      <T role="small" style={{ flex: 1 }}>
        {status === "offline" ? copy.system.offline : copy.system.apiDown}
      </T>
      {status === "api-down" ? (
        <Pressable accessibilityRole="button" onPress={retry} style={[s.bannerBtn, { backgroundColor: c.card }]}>
          <T role="small" style={{ fontFamily: fonts.semibold }}>
            {copy.system.retry}
          </T>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Scrollable tab screen with safe areas and the connectivity banner. */
export function Screen({ children, banner = true, contentStyle }: { children: React.ReactNode; banner?: boolean; contentStyle?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const kb = useKeyboardScroll();
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: c.bg }}>
      {banner ? <Banner /> : null}
      <ScrollView {...kb} contentContainerStyle={[{ padding: 16, paddingBottom: 40, gap: 16, maxWidth: 720, width: "100%", alignSelf: "center" }, contentStyle]} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * A scrolling screen with a header that stays on top: it firms up (card colour + hairline) once you scroll,
 * and on tab screens (`large`) the small title fades in when the big one scrolls away.
 * `footer` floats above the bottom edge (and above the tab bar on tab screens) so the main action is always in reach.
 */
export function Page({
  title,
  large,
  back = !large,
  action,
  footer,
  children,
  banner = true,
  contentStyle,
}: {
  title: string;
  large?: boolean;
  back?: boolean;
  action?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  banner?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const kb = useKeyboardScroll();
  const [y] = useState(() => new Animated.Value(0));
  const [footerH, setFooterH] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [rise] = useState(() => new Animated.Value(24));
  const hasFooter = Boolean(footer);
  useEffect(() => {
    if (hasFooter) Animated.spring(rise, { toValue: 0, useNativeDriver: true, bounciness: 5 }).start();
  }, [hasFooter, rise]);
  const firm = y.interpolate({ inputRange: large ? [28, 56] : [0, 16], outputRange: [0, 1], extrapolate: "clamp" });
  const titleY = large ? y.interpolate({ inputRange: [28, 56], outputRange: [8, 0], extrapolate: "clamp" }) : 0;
  const bar = (
    <View style={s.pageBar}>
      {back ? <IconButton icon="back" label={copy.welcome.back} onPress={() => (router.canGoBack() ? router.back() : router.replace("/today"))} /> : <View style={{ width: 48 }} />}
      <Animated.View style={{ flex: 1, opacity: large ? firm : 1, transform: [{ translateY: titleY }] }}>
        <T role="heading" header={!large} center numberOfLines={1}>
          {title}
        </T>
      </Animated.View>
      {action ?? <View style={{ width: 48 }} />}
    </View>
  );
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: c.bg }}>
      {banner ? <Banner /> : null}
      <View style={{ flex: 1 }}>
        <View pointerEvents={large && !scrolled ? "box-none" : "auto"} style={large ? { position: "absolute", top: 0, left: 0, right: 0, zIndex: 2 } : { zIndex: 2 }}>
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: c.card, borderBottomWidth: StyleSheet.hairlineWidth * 2, borderBottomColor: c.line, opacity: firm }]} />
          {large ? <Animated.View style={{ opacity: firm }} pointerEvents={scrolled ? "auto" : "none"}>{bar}</Animated.View> : bar}
        </View>
        <Animated.ScrollView
          ref={kb.ref as never}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y } } }], {
            useNativeDriver: true,
            listener: (e: { nativeEvent: { contentOffset: { y: number } } }) => {
              kb.onScroll(e as never);
              const past = e.nativeEvent.contentOffset.y > 40;
              if (past !== scrolled) setScrolled(past);
            },
          })}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 32 + footerH, gap: 16, maxWidth: 720, width: "100%", alignSelf: "center" }, contentStyle]}
        >
          {large ? (
            <View style={{ flexDirection: "row", alignItems: "center", minHeight: 52, marginBottom: -4 }}>
              <T role="hero" header style={{ flex: 1 }}>
                {title}
              </T>
              {action}
            </View>
          ) : null}
          {children}
        </Animated.ScrollView>
      </View>
      {footer ? (
        <Animated.View pointerEvents="box-none" onLayout={(e) => setFooterH(e.nativeEvent.layout.height)} style={{ position: "absolute", left: 0, right: 0, bottom: 0, transform: [{ translateY: rise }] }}>
          {[0.25, 0.55, 0.85].map((o) => (
            <View key={o} pointerEvents="none" style={{ height: 6, backgroundColor: c.bg, opacity: o }} />
          ))}
          <View style={{ backgroundColor: c.bg, paddingHorizontal: 16, paddingTop: 4, paddingBottom: (large ? 0 : insets.bottom) + 12, gap: 8 }}>
            <View style={{ maxWidth: 688, width: "100%", alignSelf: "center", gap: 8 }}>{footer}</View>
          </View>
        </Animated.View>
      ) : null}
    </SafeAreaView>
  );
}

/** One-line nudge for guests: save progress with an account. */
export function SaveBanner({ title, body }: { title: string; body?: string }) {
  const { c } = useTheme();
  return (
    <View style={[s.saveBanner, { backgroundColor: c.brandSoft, borderColor: c.line }]}>
      <Cody animation="love" size={44} />
      <View style={{ flex: 1, gap: 2 }}>
        <T role="label" numberOfLines={2}>
          {title}
        </T>
        {body ? (
          <T role="small" color="textMuted" numberOfLines={2}>
            {body}
          </T>
        ) : (
          <Pressable accessibilityRole="link" onPress={() => router.push("/login")} hitSlop={10}>
            <T role="small" color="brandText" style={{ fontFamily: fonts.semibold }}>
              {copy.you.saveCard.login}
            </T>
          </Pressable>
        )}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={copy.you.saveCard.cta} onPress={() => router.push("/signup")} style={({ pressed }) => [s.saveBtn, { backgroundColor: c.brand, transform: [{ scale: pressed ? 0.96 : 1 }] }]}>
        <T role="label" style={{ color: c.onBrand }}>
          {copy.you.saveCard.short}
        </T>
      </Pressable>
    </View>
  );
}

/** Full-screen flow (welcome, orientation, auth) with a pinned footer. */
export function Flow({ top, children, footer, scroll = false }: { top?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; scroll?: boolean }) {
  const { c } = useTheme();
  const kb = useKeyboardScroll();
  const body = scroll ? (
    <ScrollView {...kb} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingVertical: 12, gap: 14 }} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    <View style={{ flex: 1, paddingHorizontal: 20, justifyContent: "center", alignItems: "center", gap: 14 }}>{children}</View>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <KeyboardAvoidingView style={{ flex: 1, width: "100%", maxWidth: 560, alignSelf: "center" }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {top ? <View style={s.flowTop}>{top}</View> : null}
        {body}
        {footer ? <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 8 }}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Steps({ count, current, label }: { count: number; current: number; label: string }) {
  const { c } = useTheme();
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: count, now: current + 1 }} style={{ flex: 1, gap: 4, maxWidth: 280 }}>
      <T role="small" center color="textMuted">{label}</T>
      <View style={{ flexDirection: "row", gap: 6 }}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: i <= current ? c.brand : c.sunken }} />
      ))}
      </View>
    </View>
  );
}

export function TopBar({ title, onBack, action }: { title?: string; onBack?: () => void; action?: React.ReactNode }) {
  return (
    <View style={s.topbar}>
      <IconButton icon="back" label={copy.welcome.back} onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace("/today")))} />
      {title ? (
        <T role="heading" header center style={{ flex: 1 }}>
          {title}
        </T>
      ) : (
        <View style={{ flex: 1 }} />
      )}
      {action ?? <View style={{ width: 48 }} />}
    </View>
  );
}

/* ---------- progress visuals ---------- */

export function GoalRing({ done, goal, size = 92 }: { done: number; goal: number; size?: number }) {
  const { c } = useTheme();
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const frac = Math.min(1, goal ? done / goal : 0);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={copy.a11y.goalRing(Math.min(done, goal), goal)} style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.sunken} strokeWidth={10} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={frac >= 1 ? c.success : c.brand}
          strokeWidth={10}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circ * frac} ${circ}`}
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
        <T role="label">{`${Math.round(frac * 100)}%`}</T>
      </View>
    </View>
  );
}

const GLYPH: Record<string, string> = { pawn: "♟\uFE0E", knight: "♞\uFE0E", bishop: "♝\uFE0E", rook: "♜\uFE0E", queen: "♛\uFE0E", king: "♚\uFE0E" };

export function RankCurve({ xp }: { xp: number }) {
  const { c } = useTheme();
  const r = rankFor(xp);
  const W = 320;
  const H = 130;
  const pts = RANKS.map((_, i) => {
    const t = i / (RANKS.length - 1);
    return [28 + t * (W - 56), H - 30 - Math.pow(t, 1.35) * (H - 62)] as const;
  });
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");
  const next = pts[r.index + 1];
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={copy.a11y.rank(copy.ranks[r.rank], r.toNext, r.next ? copy.ranks[r.next] : null)}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Path d={d} stroke={c.line} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        {next ? (
          <Line
            x1={pts[r.index][0]}
            y1={pts[r.index][1]}
            x2={pts[r.index][0] + (next[0] - pts[r.index][0]) * r.fraction}
            y2={pts[r.index][1] + (next[1] - pts[r.index][1]) * r.fraction}
            stroke={c.brand}
            strokeWidth={6}
            strokeLinecap="round"
          />
        ) : null}
        {pts.map(([x, y], i) => {
          const reached = i <= r.index;
          return (
            <G key={RANKS[i].id}>
              {i === r.index ? <Circle cx={x} cy={y} r={27} fill={c.brand} opacity={0.18} /> : null}
              <Circle cx={x} cy={y} r={20} fill={reached ? c.brand : c.card} stroke={reached ? c.brand : c.line} strokeWidth={3} />
              <SvgText x={x} y={y + 8} fontSize={22} textAnchor="middle" fill={reached ? c.onBrand : c.textMuted}>
                {GLYPH[RANKS[i].id]}
              </SvgText>
            </G>
          );
        })}
      </Svg>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, marginTop: 4 }}>
        <T role="label" color="brandText">
          {copy.ranks[r.rank]}
        </T>
        <T role="small" color="textMuted">
          {r.next ? copy.today.rankToNext(r.toNext, copy.ranks[r.next]) : copy.a11y.rank(copy.ranks[r.rank], 0, null)}
        </T>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  iconBtn: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 36, paddingHorizontal: 12, borderRadius: radius.pill },
  row: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 60, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14 },
  switch: { width: 52, height: 32, borderRadius: 16, padding: 3 },
  knob: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#FFFFFF", shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  seg: { flexDirection: "row", padding: 4, borderRadius: 18, gap: 4 },
  segItem: { flex: 1, minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  choice: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingHorizontal: 20, borderRadius: 18, borderWidth: 2, alignSelf: "stretch" },
  input: { minHeight: minTarget, borderRadius: 16, borderWidth: 2, paddingHorizontal: 18, fontSize: 17 },
  eye: { position: "absolute", right: 4, top: 4, width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 22, paddingTop: 24, gap: 12, alignItems: "center", width: "100%", maxWidth: 560, alignSelf: "center" },
  toast: { position: "absolute", left: 24, right: 24, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 16, alignSelf: "center", maxWidth: 440 },
  banner: { flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 16, marginTop: 8, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16 },
  bannerBtn: { minHeight: 44, paddingHorizontal: 14, borderRadius: 22, justifyContent: "center" },
  flowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 56, paddingHorizontal: 12 },
  topbar: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 56 },
  pageBar: { flexDirection: "row", alignItems: "center", gap: 4, height: 56, paddingHorizontal: 8, maxWidth: 720, width: "100%", alignSelf: "center" },
  sheetGrip: { alignSelf: "stretch", alignItems: "center", paddingTop: 12, paddingBottom: 18, marginTop: -24, marginBottom: -8 },
  saveBanner: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingLeft: 8, paddingRight: 10, borderRadius: 20, borderWidth: 1 },
  saveBtn: { minHeight: 44, paddingHorizontal: 16, borderRadius: 22, justifyContent: "center" },
});
