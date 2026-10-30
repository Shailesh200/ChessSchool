import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AccountResetPage from "./page";

vi.mock("./AccountResetClient", () => ({
  AccountResetClient: ({ token }: { token: string }) => (
    <div data-testid="account-reset-client">{token}</div>
  ),
}));

describe("/account/reset", () => {
  it("passes the token query param to the client reset flow", async () => {
    const ui = await AccountResetPage({
      searchParams: Promise.resolve({ token: "abc123" }),
    });
    render(ui);
    expect(screen.getByTestId("account-reset-client").textContent).toBe("abc123");
  });

  it("wraps text for 320 px (no truncation utilities)", () => {
    const src = readFileSync(path.join(__dirname, "page.tsx"), "utf8");
    expect(src).not.toMatch(/\btruncate\b|line-clamp|text-ellipsis|whitespace-nowrap/);
  });
});
