/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PremiumClassDetailView } from "./PremiumClassDetailView";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("PremiumClassDetailView", () => {
  it("renders class header and exam row", () => {
    render(
      <PremiumClassDetailView
        cls={{ id: "class-pieces", title: "Knight forks", emoji: "♞", blurb: "Attack two pieces." }}
        lessons={[
          { id: "l1", title: "What is a fork?", subtitle: "", emoji: "♞" },
          { id: "l2", title: "Spot the fork", subtitle: "", emoji: "♞" },
        ]}
        examLesson={{ id: "exam", title: "Class exam" }}
        allClasses={[
          {
            id: "class-pieces",
            title: "Knight forks",
            emoji: "♞",
            blurb: "",
            lessonIds: ["l1", "l2"],
            examId: "exam",
          },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Knight forks" })).toBeTruthy();
    expect(screen.getByText(/Class exam/i)).toBeTruthy();
    expect(screen.getByText(/Class 1 of 1/)).toBeTruthy();
  });
});
