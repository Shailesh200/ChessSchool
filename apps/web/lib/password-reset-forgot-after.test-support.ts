/** Vitest-only queue for mocked `after()` callbacks from the forgot-password route. */
export const forgotPasswordAfterQueue: Array<() => void | Promise<void>> = [];

export async function flushForgotPasswordAfterQueue(): Promise<void> {
  while (forgotPasswordAfterQueue.length > 0) {
    const task = forgotPasswordAfterQueue.shift();
    if (task) await task();
  }
}
