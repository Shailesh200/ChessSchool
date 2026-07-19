import { describe, it, expect, afterEach } from "vitest";
import { createIsolatedTestDb } from "@/lib/test-db.harness";
import {
  users,
  lessons,
  classes,
  semesters,
  lessonRecords,
  progress,
  analyticsEvents,
  profiles,
} from "@/db/schema";
import { getAdminAnalytics } from "@/lib/admin-analytics";

describe("getAdminAnalytics", () => {
  let teardown: (() => void) | undefined;

  afterEach(() => {
    teardown?.();
    teardown = undefined;
  });

  it("aggregates users, lesson activity, and events", async () => {
    const iso = createIsolatedTestDb();
    teardown = iso.teardown;
    const { db } = iso;
    const now = Date.now();

    await db.insert(semesters).values({
      id: "sem-1",
      title: "S1",
      blurb: "",
      color: "#000",
      stage: "elementary",
      sortOrder: 0,
    });
    await db.insert(classes).values({
      id: "class-1",
      semesterId: "sem-1",
      title: "C1",
      emoji: "♟️",
      blurb: "",
      difficulty: 1,
      sortOrder: 0,
    });
    await db.insert(lessons).values({
      id: "lesson-a",
      classId: "class-1",
      title: "Fork basics",
      subtitle: "",
      emoji: "♟️",
      tag: "drill",
      xp: 20,
      isExam: 0,
      prerequisites: "[]",
      steps: "[]",
      sortOrder: 0,
    });

    await db.insert(users).values([
      {
        id: "u1",
        email: "a@test.com",
        passwordHash: "x",
        name: "Ada",
        role: "student",
        createdAt: now - 2 * 86_400_000,
      },
      {
        id: "u2",
        email: "b@test.com",
        passwordHash: "x",
        name: "Bob",
        role: "admin",
        createdAt: now,
      },
    ]);

    await db.insert(profiles).values({
      userId: "u1",
      studentNo: "CS-1",
      enrolledAt: now,
      onboarded: 1,
    });

    await db.insert(progress).values({
      userId: "u1",
      xp: 120,
      streak: 3,
      updatedAt: now,
    });

    await db.insert(lessonRecords).values({
      id: "u1:lesson-a",
      userId: "u1",
      lessonId: "lesson-a",
      mastery: 0.95,
      attempts: 4,
      lastSeen: now,
      dueAt: 0,
    });

    await db.insert(analyticsEvents).values({
      id: "ev1",
      name: "lesson_complete",
      props: "{}",
      userId: "u1",
      createdAt: now,
    });

    const analytics = await getAdminAnalytics(db);

    expect(analytics.users.total).toBe(2);
    expect(analytics.users.students).toBe(1);
    expect(analytics.users.admins).toBe(1);
    expect(analytics.users.withProgress).toBe(1);
    expect(analytics.users.enrolled).toBe(1);
    expect(analytics.users.onboarded).toBe(1);
    expect(analytics.users.signedUpLast7d).toBe(2);
    expect(analytics.lessons.catalogSize).toBe(1);
    expect(analytics.lessons.started).toBe(1);
    expect(analytics.lessons.mastered).toBe(1);
    expect(analytics.lessons.totalAttempts).toBe(4);
    expect(analytics.activity.activeLast7d).toBe(1);
    expect(analytics.activity.totalXp).toBe(120);
    expect(analytics.topLessons[0]?.title).toBe("Fork basics");
    expect(analytics.events.find((e) => e.name === "lesson_complete")?.count).toBe(1);
  });
});
