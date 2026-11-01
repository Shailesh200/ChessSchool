import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * Minimal react-native stand-in for component tests (vitest runs in node, with
 * no RNTL). Every host component renders a <div data-rn="Name" data-props="json">
 * so a test can assert the exact props (numberOfLines, maxFontSizeMultiplier,
 * style) a real RN renderer would receive.
 */
function host(name: string) {
  return function Host(props: { children?: ReactNode } & Record<string, unknown>) {
    const { children, ...rest } = props;
    return createElement(
      "div",
      { "data-rn": name, "data-props": JSON.stringify(rest) },
      children as ReactNode,
    );
  };
}

class AnimatedValue {
  constructor(public v: number) {}
  interpolate() {
    return "0%";
  }
}

export const rnMock = {
  View: host("View"),
  Text: host("Text"),
  Pressable: host("Pressable"),
  ScrollView: host("ScrollView"),
  KeyboardAvoidingView: host("KeyboardAvoidingView"),
  StyleSheet: {
    create: <T>(s: T) => s,
    flatten: (s: unknown) =>
      Array.isArray(s)
        ? Object.assign({}, ...s.flat(Infinity).filter(Boolean))
        : (s ?? {}),
  },
  Platform: { OS: "android" },
  Animated: {
    View: host("Animated.View"),
    Value: AnimatedValue,
    timing: () => ({ start: () => undefined }),
  },
};

export type RnNode = { name: string; props: Record<string, any> };

/** Render a React element and return every RN host node in document order. */
export function renderRn(element: ReactNode): RnNode[] {
  const html = renderToStaticMarkup(element as never);
  const out: RnNode[] = [];
  const re = /data-rn="([^"]+)" data-props="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const json = m[2]
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
    out.push({ name: m[1], props: JSON.parse(json) });
  }
  return out;
}

export function flatStyle(style: unknown): Record<string, any> {
  return rnMock.StyleSheet.flatten(style) as Record<string, any>;
}
