/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sheet } from "./Sheet";

describe("Sheet keyboard", () => {
  const original = window.visualViewport;

  afterEach(() => {
    Object.defineProperty(window, "visualViewport", { configurable: true, value: original });
  });

  it("lifts the dialog by the keyboard overlap so the input is not covered", () => {
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
    const viewport = {
      height: 430,
      offsetTop: 0,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    };
    Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });

    render(
      <Sheet open onClose={() => undefined} title="Add to your journal">
        <textarea id="note" />
      </Sheet>,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog.style.marginBottom).toBe("370px");
    expect(dialog.style.maxHeight).toBe("calc(100dvh - 370px)");
    expect(dialog.className).toContain("overflow-y-auto");
    expect(document.getElementById("note")).toBeTruthy();
  });
});