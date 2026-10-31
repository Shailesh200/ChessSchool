import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ForgotPasswordPage from "./page";

vi.mock("./ForgotPasswordForm", () => ({
  ForgotPasswordForm: () => <div data-testid="forgot-form">form</div>,
}));

describe("/forgot-password", () => {
  it("shows the heading and email form", () => {
    render(<ForgotPasswordPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Forgot your password?" }),
    ).toBeTruthy();
    expect(screen.getByTestId("forgot-form")).toBeTruthy();
  });

  it("wraps its text: no truncate, no line-clamp (320 px safe)", () => {
    const src = readFileSync(path.join(__dirname, "page.tsx"), "utf8");
    expect(src).not.toMatch(/\btruncate\b|line-clamp|text-ellipsis|whitespace-nowrap/);
  });
});
