/** @vitest-environment jsdom */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { LoginResetRedirect } from "./LoginResetRedirect";

describe("LoginResetRedirect", () => {
  const replace = vi.fn();

  beforeEach(() => {
    replace.mockReset();
    vi.stubGlobal("location", {
      ...window.location,
      search: "?token=email-tok",
      hash: "",
      replace,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("redirects /login/reset to /account/reset preserving query", () => {
    render(<LoginResetRedirect />);
    expect(replace).toHaveBeenCalledWith("/account/reset?token=email-tok");
  });
});
