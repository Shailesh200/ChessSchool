import type { EmailMessage } from "./types";
import type { EmailTransport } from "./transport";

/** Captured password-reset emails — only for Vitest. */
export const passwordResetTestOutbox: EmailMessage[] = [];

export function createPasswordResetTestTransport(): EmailTransport {
  return {
    name: "console",
    async send(message) {
      passwordResetTestOutbox.push(message);
      return { id: "test" };
    },
  };
}

export function resetPasswordResetTestOutbox(): void {
  passwordResetTestOutbox.length = 0;
}
