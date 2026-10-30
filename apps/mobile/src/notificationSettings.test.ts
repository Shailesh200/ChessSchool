import { describe, expect, it } from "vitest";
import { NOTIFICATION_DEFAULTS } from "./notificationDefaults";

describe("notification reminder settings", () => {
  it("defaults notifications off with 6 PM suggestion", () => {
    expect(NOTIFICATION_DEFAULTS.notificationsEnabled).toBe(false);
    expect(NOTIFICATION_DEFAULTS.notificationHour).toBe(18);
    expect(NOTIFICATION_DEFAULTS.notificationMinute).toBe(0);
  });
});
