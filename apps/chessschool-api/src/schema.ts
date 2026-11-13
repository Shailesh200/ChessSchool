import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("cs_users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull().default(""),
  passwordHash: text("password_hash"),
  googleSub: text("google_sub").unique(),
  appleSub: text("apple_sub").unique(),
  guestId: text("guest_id"),
  /** member: full account. guest: still inside the three-class cap. */
  kind: text("kind").notNull().default("member"),
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
  avatar: text("avatar"),
  flair: text("flair"),
});

export const classes = sqliteTable("cs_classes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("created_at").notNull(),
  origin: text("origin").notNull().default("app"),
});

export const classMembers = sqliteTable(
  "cs_class_members",
  {
    classId: text("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    joinedAt: integer("joined_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.classId, t.userId] })],
);

export const progress = sqliteTable("cs_progress", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  data: text("data").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

/** Course-wide data: row "meta" holds { version, comingSoon }. Units and lessons have their own tables. */
export const course = sqliteTable("cs_course", {
  id: text("id").primaryKey(),
  data: text("data").notNull(),
});

export const courseUnits = sqliteTable("cs_course_units", {
  id: text("id").primaryKey(),
  position: integer("position").notNull(),
  title: text("title").notNull(),
  sub: text("sub").notNull(),
});

export const courseLessons = sqliteTable("cs_course_lessons", {
  id: text("id").primaryKey(),
  unitId: text("unit_id").notNull(),
  position: integer("position").notNull(),
  title: text("title").notNull(),
  sub: text("sub").notNull(),
  minutes: integer("minutes").notNull(),
  xp: integer("xp").notNull(),
  /** JSON array of lesson steps, as the app's lesson runner plays them. */
  steps: text("steps").notNull(),
});

export const puzzles = sqliteTable("cs_puzzles", {
  id: text("id").primaryKey(),
  fen: text("fen").notNull(),
  moves: text("moves").notNull(),
  rating: integer("rating").notNull(),
  themes: text("themes").notNull(),
  packVersion: text("pack_version").notNull(),
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
    apple_sub TEXT UNIQUE,
    guest_id TEXT,
    kind TEXT NOT NULL DEFAULT 'member',
    created_at INTEGER NOT NULL
  )`,
  `ALTER TABLE cs_users ADD COLUMN kind TEXT NOT NULL DEFAULT 'member'`,
  `ALTER TABLE cs_users ADD COLUMN apple_sub TEXT`,
  `CREATE UNIQUE INDEX IF NOT EXISTS cs_users_apple_sub ON cs_users(apple_sub)`,
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
    sound INTEGER NOT NULL DEFAULT 1,
    avatar TEXT,
    flair TEXT
  )`,
  `ALTER TABLE cs_profiles ADD COLUMN avatar TEXT`,
  `ALTER TABLE cs_profiles ADD COLUMN flair TEXT`,
  `CREATE TABLE IF NOT EXISTS cs_classes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    owner_id TEXT NOT NULL REFERENCES cs_users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    origin TEXT NOT NULL DEFAULT 'app'
  )`,
  `ALTER TABLE cs_classes ADD COLUMN origin TEXT NOT NULL DEFAULT 'app'`,
  `CREATE TABLE IF NOT EXISTS cs_class_members (
    class_id TEXT NOT NULL REFERENCES cs_classes(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES cs_users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    joined_at INTEGER NOT NULL,
    PRIMARY KEY (class_id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS cs_progress (
    user_id TEXT PRIMARY KEY REFERENCES cs_users(id) ON DELETE CASCADE,
    data TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS cs_course (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS cs_course_units (
    id TEXT PRIMARY KEY,
    position INTEGER NOT NULL,
    title TEXT NOT NULL,
    sub TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS cs_course_lessons (
    id TEXT PRIMARY KEY,
    unit_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    title TEXT NOT NULL,
    sub TEXT NOT NULL,
    minutes INTEGER NOT NULL,
    xp INTEGER NOT NULL,
    steps TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS cs_course_lessons_position ON cs_course_lessons (position)`,
  `CREATE TABLE IF NOT EXISTS cs_puzzles (
    id TEXT PRIMARY KEY,
    fen TEXT NOT NULL,
    moves TEXT NOT NULL,
    rating INTEGER NOT NULL,
    themes TEXT NOT NULL,
    pack_version TEXT NOT NULL
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
