export const PASSWORD_FORGOT_API = "/api/auth/password/forgot" as const;
export const PASSWORD_RESET_API = "/api/auth/password/reset" as const;

export type PasswordForgotRequest = { email: string };

export type PasswordForgotSuccess = { ok: true; message: string };

export type PasswordResetRequest = { token: string; password: string };

export type PasswordResetSuccess = { ok: true };

export type PasswordResetApiErrorBody = { error: string };

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function errorMessage(body: unknown, fallback: string): string {
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as { error: unknown }).error === "string"
  ) {
    return (body as { error: string }).error;
  }
  return fallback;
}

/** POST /api/auth/password/forgot — always returns generic success on 200. */
export async function postPasswordForgot(
  email: string,
): Promise<
  | { ok: true; data: PasswordForgotSuccess }
  | { ok: false; status: number; error: string }
> {
  const res = await fetch(PASSWORD_FORGOT_API, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email } satisfies PasswordForgotRequest),
  });
  const body = await readJson(res);
  if (res.ok) {
    return { ok: true, data: body as PasswordForgotSuccess };
  }
  return {
    ok: false,
    status: res.status,
    error:
      res.status === 429
        ? "Too many attempts. Try again in a minute."
        : errorMessage(body, "invalid email"),
  };
}

/** POST /api/auth/password/reset — sets a new password and invalidates sessions. */
export async function postPasswordReset(
  token: string,
  password: string,
): Promise<
  | { ok: true; data: PasswordResetSuccess }
  | { ok: false; status: number; error: string }
> {
  const res = await fetch(PASSWORD_RESET_API, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, password } satisfies PasswordResetRequest),
  });
  const body = await readJson(res);
  if (res.ok) {
    return { ok: true, data: body as PasswordResetSuccess };
  }
  return {
    ok: false,
    status: res.status,
    error:
      res.status === 429
        ? "Too many attempts. Try again in a minute."
        : errorMessage(body, "invalid request"),
  };
}
