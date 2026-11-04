import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("cs_users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull().default(""),
  passwordHash: text("password_hash"),
  googleSub: text("google_sub").unique(),
  guestId: text("guest_id"),
  createdAt: integer("created_at").notNull(),
});

export const sessions = sqliteTable("cs_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
});

export const profiles = sqliteTable("cs_profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  who: text("who"),
  dailyMinutes: integer("daily_minutes").notNull().default(10),
  appearance: text("appearance").notNull().default("system"),
  sound: integer("sound", { mode: "boolean" }).notNull().default(true),
});

export const progress = sqliteTable("cs_progress", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  data: text("data").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const feedback = sqliteTable("cs_feedback", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  guestId: text("guest_id"),
  mood: text("mood").notNull(),
  message: text("message").notNull(),
  context: text("context").notNull(),
  createdAt: integer("created_at").notNull(),
});

/** Idempotent bootstrap; this schema is new and owns only cs_* tables. */
export const BOOTSTRAP_SQL = [
  `CREATE TABLE IF NOT EXISTS cs_users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL DEFAULT '',
    password_hash TEXT,
    google_sub TEXT UNIQUE,
    guest_id TEXT,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS cs_sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES cs_users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS cs_sessions_user ON cs_sessions(user_id)`,
  `CREATE TABLE IF NOT EXISTS cs_profiles (
    user_id TEXT PRIMARY KEY REFERENCES cs_users(id) ON DELETE CASCADE,
    who TEXT,
    daily_minutes INTEGER NOT NULL DEFAULT 10,
    appearance TEXT NOT NULL DEFAULT 'system',
    sound INTEGER NOT NULL DEFAULT 1
  )`,
  `CREATE TABLE IF NOT EXISTS cs_progress (
    user_id TEXT PRIMARY KEY REFERENCES cs_users(id) ON DELETE CASCADE,
    data TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS cs_feedback (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    guest_id TEXT,
    mood TEXT NOT NULL,
    message TEXT NOT NULL,
    context TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
];
