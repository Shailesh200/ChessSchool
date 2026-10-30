import { describe, expect, it } from "vitest";
import { houseForGoal } from "./profile-shared";

describe("houseForGoal premium onboarding goals", () => {
  it("assigns houses for illustrated onboarding goal ids", () => {
    expect(houseForGoal("learn-scratch")).toBe("Pawns");
    expect(houseForGoal("get-tactics")).toBe("Bishops");
    expect(houseForGoal("play-fun")).toBe("Knights");
  });
});
