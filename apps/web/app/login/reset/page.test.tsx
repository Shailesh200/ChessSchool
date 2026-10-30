/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/premium-ui/screens/passwordResetPremiumScreens", () => ({
  PremiumResetPasswordScreen: () => <div data-testid="premium-reset-19b" />,
}));

import LoginResetPasswordPage from "./page";

describe("/login/reset page", () => {
  it("renders the premium 19b reset screen (no redirect to /account/reset)", () => {
    render(<LoginResetPasswordPage />);
    expect(screen.getByTestId("premium-reset-19b")).toBeInTheDocument();
  });
});
