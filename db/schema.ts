import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

/**
 * ChessSchool database schema (SQLite via Drizzle).
 *
 * Local dev uses a SQLite file (`local.db`); for hosting, the same Drizzle schema
 * points at Turso (libSQL) or Postgres with no app changes. Holds auth, student
 * profiles, per-user progress, and the curriculum CMS (semesters/classes/lessons).
 */

// ── Auth & student ────────────────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("student"), // "student" | "admin"
  createdAt: integer("created_at").notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(), // opaque session token (also the cookie value)
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at").notNull(),
});

export const profiles = sqliteTable("profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  studentNo: text("student_no").notNull(),
  enrolledAt: integer("enrolled_at").notNull(),
  rankTitle: text("rank_title").notNull().default("Novice"),
  avatarUrl: text("avatar_url"), // stores a chosen emoji avatar locally
  goal: text("goal"),
  house: text("house"),
  onboarded: integer("onboarded").notNull().default(0),
});

export const progress = sqliteTable("progress", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  xp: integer("xp").notNull().default(0),
  streak: integer("streak").notNull().default(0),
  lastActiveDay: text("last_active_day"),
  dailyGoalXp: integer("daily_goal_xp").notNull().default(50),
  graduatedClasses: text("graduated_classes").notNull().default("[]"), // JSON
  updatedAt: integer("updated_at").notNull().default(0),
});

export const lessonRecords = sqliteTable("lesson_records", {
  id: text("id").primaryKey(), // `${userId}:${lessonId}`
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  lessonId: text("lesson_id").notNull(),
  mastery: real("mastery").notNull().default(0),
  attempts: integer("attempts").notNull().default(0),
  lastSeen: integer("last_seen").notNull().default(0),
  dueAt: integer("due_at").notNull().default(0),
});

// ── Curriculum CMS (admin-editable / backend-swappable) ────────────────────
export const semesters = sqliteTable("semesters", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  blurb: text("blurb").notNull().default(""),
  color: text("color").notNull().default("#5b5bd6"),
  stage: text("stage").notNull().default("elementary"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const classes = sqliteTable("classes", {
  id: text("id").primaryKey(),
  semesterId: text("semester_id")
    .notNull()
    .references(() => semesters.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  emoji: text("emoji").notNull().default("♟️"),
  blurb: text("blurb").notNull().default(""),
  difficulty: integer("difficulty").notNull().default(1),
  examId: text("exam_id"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const lessons = sqliteTable("lessons", {
  id: text("id").primaryKey(),
  classId: text("class_id")
    .notNull()
    .references(() => classes.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  subtitle: text("subtitle").notNull().default(""),
  emoji: text("emoji").notNull().default("♟️"),
  tag: text("tag").notNull().default("drill"),
  xp: integer("xp").notNull().default(20),
  isExam: integer("is_exam").notNull().default(0),
  prerequisites: text("prerequisites").notNull().default("[]"), // JSON string[]
  steps: text("steps").notNull(), // JSON LessonStep[]
  sortOrder: integer("sort_order").notNull().default(0),
});

// Shareable live PvP sessions (#10b) — both players poll for the latest state.
export const gameSessions = sqliteTable("game_sessions", {
  id: text("id").primaryKey(),
  fen: text("fen").notNull(),
  pgn: text("pgn").notNull().default(""),
  lastFrom: text("last_from"),
  lastTo: text("last_to"),
  turn: text("turn").notNull().default("w"),
  status: text("status").notNull().default("waiting"), // waiting | active | over
  result: text("result"),
  blackJoined: integer("black_joined").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export type DBUser = typeof users.$inferSelect;
export type DBLesson = typeof lessons.$inferSelect;
export type DBClass = typeof classes.$inferSelect;
export type DBSemester = typeof semesters.$inferSelect;
export type DBGameSession = typeof gameSessions.$inferSelect;
