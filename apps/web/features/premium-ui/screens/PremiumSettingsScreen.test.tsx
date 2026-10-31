/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ANALYTICS_SWITCH_LABEL } from "@/core/analytics/copy";
import { PremiumSettingsScreen } from "./PremiumSettingsScreen";

describe("PremiumSettingsScreen accessible names", () => {
  it("gives every button and switch an accessible name", () => {
    render(<PremiumSettingsScreen />);

    const buttons = screen.queryAllByRole("button");
    expect(screen.queryAllByRole("button", { name: /.+/ })).toHaveLength(
      buttons.length,
    );

    const switches = screen.getAllByRole("switch");
    expect(switches.length).toBeGreaterThan(0);
    expect(screen.getAllByRole("switch", { name: /.+/ })).toHaveLength(switches.length);

    expect(switches).toHaveLength(1);
    expect(
      screen.getByRole("switch", { name: ANALYTICS_SWITCH_LABEL }),
    ).toHaveAttribute("aria-checked");
    expect(screen.getByRole("link", { name: "Back to Profile" })).toBeTruthy();
  });
});
