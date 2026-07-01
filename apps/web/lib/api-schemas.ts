import { z } from "zod";

export const authCredentialsSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
});

export const authRegisterSchema = authCredentialsSchema.extend({
  name: z.string().trim().min(1).max(80),
});

const lessonRecSchema = z.object({
  mastery: z.number().min(0).max(1),
  attempts: z.number().int().min(0).max(10_000),
  lastSeen: z.number().int().min(0),
  dueAt: z.number().int().min(0),
  incorrect: z.number().int().min(0).optional(),
});

export const progressPushSchema = z.object({
  xp: z.number().int().min(0).max(10_000_000),
  streak: z.number().int().min(0).max(10_000),
  lastActiveDay: z.string().nullable(),
  graduatedClasses: z.array(z.string().max(64)).max(200),
  lessons: z.record(z.string().max(64), lessonRecSchema),
  rating: z.number().int().min(0).max(4000).optional(),
  botWins: z.number().int().min(0).max(100_000).optional(),
  dailyGoalXp: z.number().int().min(1).max(10_000).optional(),
  unlockedAchievements: z.array(z.string().max(64)).max(200).optional(),
  schoolExamsPassed: z.array(z.string().max(64)).max(50).optional(),
  weaknesses: z.record(z.string(), z.number()).optional(),
  activityDays: z.record(z.string(), z.number()).optional(),
  mistakeLog: z.array(z.unknown()).max(500).optional(),
  homeworkStreak: z.number().int().min(0).max(10_000).optional(),
  homeworkLastDay: z.string().nullable().optional(),
  recentGames: z.array(z.unknown()).max(50).optional(),
  dailyPuzzleDay: z.string().max(16).nullable().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
  homeworkDone: z.record(z.string(), z.array(z.string())).optional(),
  placementDone: z.boolean().optional(),
  journalEntries: z.array(z.object({
    id: z.string().max(64),
    day: z.string().max(16),
    date: z.number().int(),
    kind: z.enum(["lesson", "match", "review", "exam", "reflection"]),
    title: z.string().max(200),
    confidence: z.number().min(1).max(5),
    note: z.string().max(2000),
    summary: z.string().max(500),
    ref: z.string().nullable(),
  })).max(100).optional(),
});

export type ProgressPushBody = z.infer<typeof progressPushSchema>;
