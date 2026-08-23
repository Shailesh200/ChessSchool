"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { PULSE_PENDING_AUTH } from "@/lib/pulse";

const GOOGLE_ENABLED = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);

const OAUTH_ERRORS: Record<string, string> = {
  google_denied: "Google sign-in was cancelled.",
  google_state: "Google sign-in expired — please try again.",
  google_failed: "Google sign-in failed. Try email instead.",
  google_unavailable: "Google sign-in is not available right now.",
};

export function GoogleSignInButton({ next = "/welcome" }: { next?: string }) {
  const searchParams = useSearchParams();
  const oauthError = searchParams.get("error");
  const errorMessage = oauthError ? OAUTH_ERRORS[oauthError] : null;

  if (!GOOGLE_ENABLED) return null;

  const href = `/api/auth/google?next=${encodeURIComponent(next)}`;

  return (
    <div className="flex flex-col gap-2">
      {errorMessage && (
        <p className="rounded-card bg-danger/10 text-danger px-3 py-2 text-sm font-bold">
          {errorMessage}
        </p>
      )}
      <Link
        href={href}
        onClick={() => {
          try {
            const register = window.location.pathname.includes("register");
            sessionStorage.setItem(
              PULSE_PENDING_AUTH,
              register ? "signup" : "login",
            );
          } catch {
            /* private mode */
          }
        }}
        className="btn-tactile rounded-card border-hairline bg-surface-card text-ink flex h-12 items-center justify-center gap-2 border text-sm font-extrabold"
      >
        <GoogleMark />
        Continue with Google
      </Link>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
