/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PremiumMapStatePanel } from "./PremiumMapStatePanel";
import type { Catalog } from "@/features/school/structure";

const catalog = {
  allClasses: [{ id: "class-pieces", title: "Knight forks", lessonIds: ["a"], emoji: "♞", blurb: "" }],
} as unknown as Catalog;

describe("PremiumMapStatePanel", () => {
  it("renders offline illustration state", () => {
    render(<PremiumMapStatePanel state="offline" catalog={catalog} due={3} />);
    expect(screen.getByTestId("map-state-offline")).toBeTruthy();
    expect(screen.getByRole("status")).toHaveTextContent(/offline/i);
  });

  it("renders empty state CTA", () => {
    render(<PremiumMapStatePanel state="empty" catalog={catalog} due={0} />);
    expect(screen.getByTestId("map-state-empty")).toBeTruthy();
    expect(screen.getByRole("link", { name: /pick my first class/i })).toBeTruthy();
  });
});
