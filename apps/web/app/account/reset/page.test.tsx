import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AccountResetPage from "./page";

vi.mock("./AccountResetClient", () => ({
  AccountResetClient: () => <div data-testid="account-reset-client">client</div>,
}));

describe("/account/reset", () => {
  it("shows the heading and client reset flow", () => {
    render(<AccountResetPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Choose a new password" }),
    ).toBeTruthy();
    expect(screen.getByTestId("account-reset-client")).toBeTruthy();
  });

  it("wraps text for 320 px (no truncation utilities)", () => {
    const src = readFileSync(path.join(__dirname, "page.tsx"), "utf8");
    expect(src).not.toMatch(/\btruncate\b|line-clamp|text-ellipsis|whitespace-nowrap/);
  });
});
