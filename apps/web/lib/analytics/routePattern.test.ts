import { describe, expect, it } from "vitest";
import { routeArea, routePattern } from "@/lib/analytics/routePattern";

describe("routePattern", () => {
  it("keeps static routes", () => {
    expect(routePattern("/")).toBe("/");
    expect(routePattern("/admin")).toBe("/admin");
    expect(routePattern("/library")).toBe("/library");
    expect(routePattern("/review")).toBe("/review");
  });

  it("collapses lesson, class, homework, review, exam ids", () => {
    expect(routePattern("/lesson/pawn-power")).toBe("/lesson/:id");
    expect(routePattern("/class/beginner-1")).toBe("/class/:id");
    expect(routePattern("/class/beginner-1/exam")).toBe("/class/:id/exam");
    expect(routePattern("/homework/hw-123")).toBe("/homework/:id");
    expect(routePattern("/review/some-review")).toBe("/review/:id");
    expect(routePattern("/exam/school/stage-2")).toBe("/exam/school/:id");
    expect(routePattern("/library/lesson/pawn-power")).toBe("/library/lesson/:id");
  });

  it("collapses online game ids", () => {
    expect(routePattern("/play/online/abc123def4567890")).toBe("/play/online/:id");
  });

  it("collapses UUIDs", () => {
    expect(
      routePattern("/play/online/550e8400-e29b-41d4-a716-446655440000"),
    ).toBe("/play/online/:id");
  });

  it("strips query strings", () => {
    expect(routePattern("/campus?tab=plan")).toBe("/campus");
  });
});

describe("routeArea", () => {
  it("maps core product areas", () => {
    expect(routeArea("/")).toBe("home");
    expect(routeArea("/lesson/foo")).toBe("learn");
    expect(routeArea("/academy")).toBe("learn");
    expect(routeArea("/play/arena")).toBe("play");
    expect(routeArea("/play/online/xyz")).toBe("play");
    expect(routeArea("/journal")).toBe("progress");
    expect(routeArea("/dashboard")).toBe("progress");
    expect(routeArea("/settings")).toBe("account");
    expect(routeArea("/login")).toBe("auth");
    expect(routeArea("/learn-chess")).toBe("marketing");
    expect(routeArea("/admin")).toBe("admin");
  });
});
