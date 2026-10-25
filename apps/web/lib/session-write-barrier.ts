/**
 * Test seam so two session writers can sit between the read and the UPDATE.
 * Production leaves `wait` null: no lock, no transaction, no extra delay.
 */
export const sessionWriteBarrier: { wait: (() => Promise<void>) | null } = {
  wait: null,
};
