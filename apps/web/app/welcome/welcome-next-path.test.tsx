import { describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { safeNextPath } from "@chess-school/core";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams("next=//evil.com"),
}));

vi.mock("@/core/sync/pullProgress", () => ({
  pullProgress: () => Promise.resolve(),
}));

import WelcomePage from "./page";

describe("/welcome next query", () => {
  it("does not redirect off-site for //evil.com", async () => {
    replace.mockClear();
    render(<WelcomePage />);
    await waitFor(
      () => {
        expect(replace).toHaveBeenCalled();
      },
      { timeout: 3000 },
    );
    expect(replace.mock.calls.some((args) => args[0] === "//evil.com")).toBe(false);
    expect(safeNextPath("//evil.com", "/academy")).toBe("/academy");
    expect(replace.mock.calls.at(-1)?.[0]).toBe("/academy");
  });
});
