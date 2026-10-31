/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PremiumMapStatePanel } from "./PremiumMapStatePanel";
import { buildPremiumCoursePath } from "@/features/premium-ui/pathStates";
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

  it("renders done, up-next, and locked path nodes", () => {
    const path = buildPremiumCoursePath({
      stages: [{ id: "tactics", name: "Tactics" }],
      semesters: [
        {
          id: "forks",
          title: "Forks, pins & skewers",
          stage: "tactics",
          classes: [
            { id: "pins", title: "Pins" },
            { id: "forks", title: "Knight forks" },
            { id: "skewers", title: "Skewers" },
          ],
        },
      ],
      graduatedIds: ["pins"],
      unlocked: (id) => id !== "skewers",
    });
    render(<PremiumMapStatePanel state="normal" catalog={catalog} due={6} path={path} />);
    expect(screen.getByText("Class 1 · done")).toBeTruthy();
    expect(screen.getByText("Class 2 · up next")).toBeTruthy();
    expect(screen.getByText("Class 3 · locked")).toBeTruthy();
    expect(screen.getByText("START")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Pins, Class 1 · done/ })).toBeTruthy();
  });

  it("renders empty state CTA", () => {
    render(<PremiumMapStatePanel state="empty" catalog={catalog} due={0} />);
    expect(screen.getByTestId("map-state-empty")).toBeTruthy();
    expect(screen.getByRole("link", { name: /pick my first class/i })).toBeTruthy();
  });
});
