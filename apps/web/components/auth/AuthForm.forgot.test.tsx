import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/components/auth/GoogleSignInButton", () => ({
  GoogleSignInButton: () => null,
}));

import { AuthForm } from "@/components/auth/AuthForm";

const action = async () => ({});

describe("AuthForm forgot-password link", () => {
  it("login mode links to /forgot-password", () => {
    render(<AuthForm mode="login" action={action} />);
    const link = screen.getByRole("link", { name: "Forgot password?" });
    expect(link.getAttribute("href")).toBe("/forgot-password");
    expect(link.className).not.toMatch(/truncate|line-clamp/);
  });

  it("register mode has no forgot-password link", () => {
    render(<AuthForm mode="register" action={action} />);
    expect(screen.queryByRole("link", { name: "Forgot password?" })).toBeNull();
  });
});
