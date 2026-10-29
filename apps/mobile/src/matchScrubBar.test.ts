import { isValidElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => {
  const React = require("react") as typeof import("react");
  function make(name: string) {
    function Host(props: { children?: ReactNode }) {
      return React.createElement(name, props, props.children);
    }
    Object.defineProperty(Host, "name", { value: name });
    return Host;
  }
  return {
    View: make("View"),
    Text: make("Text"),
    Pressable: make("Pressable"),
    StyleSheet: { create: (styles: unknown) => styles },
  };
});

import { MatchScrubBar, scrubBarLabel } from "./matchScrubBar";

type Flat = {
  type: string;
  text?: string;
  testID?: string;
  width?: number;
  height?: number;
  position?: string;
};

function flatten(node: ReactNode, out: Flat[] = []): Flat[] {
  if (node == null || typeof node === "boolean") return out;
  if (Array.isArray(node)) {
    for (const child of node) flatten(child, out);
    return out;
  }
  if (!isValidElement(node)) return out;
  const props = node.props as {
    children?: ReactNode;
    style?: { width?: number; height?: number; position?: string };
    testID?: string;
  };
  const type = node.type;
  if (typeof type === "function") {
    const rendered = (type as (p: unknown) => ReactNode)(node.props);
    return flatten(rendered, out);
  }
  const text = typeof props.children === "string" ? props.children : undefined;
  out.push({
    type: String(type),
    text,
    testID: props.testID,
    width: props.style?.width,
    height: props.style?.height,
    position: props.style?.position,
  });
  flatten(props.children, out);
  return out;
}

/** In-flow nodes are what the row lays out. The move-count probe is absolute and 0×0. */
function inFlow(nodes: Flat[]): Flat[] {
  return nodes.filter((node) => node.position !== "absolute" && !(node.width === 0 && node.height === 0));
}

const state = { viewing: false, viewPly: null, frameCount: 3, moveCount: 2 };

describe("MatchScrubBar visible output", () => {
  it("matches the scrub bar from before the move-count probe", () => {
    const before = inFlow(
      flatten(
        MatchScrubBar({
          ...state,
          moveCount: 0,
          onBack() {},
          onForward() {},
        }).props.children.filter((child: { props?: { testID?: string } }) => child?.props?.testID !== "play-move-count"),
      ),
    );
    const after = inFlow(
      flatten(
        MatchScrubBar({
          ...state,
          onBack() {},
          onForward() {},
        }),
      ),
    );
    const beforeText = before.map((node) => node.text).filter(Boolean);
    const afterText = after.map((node) => node.text).filter(Boolean);
    console.log("scrub before", JSON.stringify(beforeText));
    console.log("scrub after", JSON.stringify(afterText));
    expect(afterText).toEqual(beforeText);
    expect(afterText).toEqual(["⏪", scrubBarLabel(false, null, 3), "⏩"]);
    expect(afterText).toEqual(["⏪", "● live", "⏩"]);
    const full = flatten(
      MatchScrubBar({
        ...state,
        onBack() {},
        onForward() {},
      }),
    );
    const probe = full.find((node) => node.testID === "play-move-count");
    expect(probe).toMatchObject({ position: "absolute", width: 0, height: 0 });
    expect(inFlow(full).some((node) => node.testID === "play-move-count")).toBe(false);
  });
});
