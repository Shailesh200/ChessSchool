import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { OTA_SCHEMA_SQL } from "ota-server";

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

/** Lesson drafts from the admin editor (/admin/lessons), one per lesson. Not live until published. */
export const courseDrafts = sqliteTable("cs_course_drafts", {
  lessonId: text("lesson_id").primaryKey(),
  /** JSON lesson document ({ id, unit, title, sub, minutes, xp, steps }). */
  data: text("data").notNull(),
  updatedBy: text("updated_by").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

/** Full course snapshots written by each admin publish or rollback (newest last), so any one can be restored. */
export const courseVersions = sqliteTable("cs_course_versions", {
  id: text("id").primaryKey(),
  version: text("version").notNull(),
  /** JSON CourseDoc. */
  data: text("data").notNull(),
  /** "publish <lesson>", "rollback <version>" or "before first edit". */
  note: text("note").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: integer("created_at").notNull(),
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

/** A member reported from inside a class. Reviewed by an admin; the reporter also stops seeing them. */
export const reports = sqliteTable("cs_reports", {
  id: text("id").primaryKey(),
  classId: text("class_id").notNull(),
  reporterId: text("reporter_id").notNull(),
  reportedId: text("reported_id").notNull(),
  reason: text("reason").notNull(),
  note: text("note").notNull(),
  status: text("status").notNull(),
  createdAt: integer("created_at").notNull(),
});

/** `blockerId` no longer sees `blockedId` in any class. */
export const blocks = sqliteTable(
  "cs_blocks",
  {
    blockerId: text("blocker_id").notNull(),
    blockedId: text("blocked_id").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.blockerId, t.blockedId] })],
);

/** Lessons a class monitor set for the class, due on a day (YYYY-MM-DD). `lessons` is a JSON id list. */
export const homework = sqliteTable("cs_class_homework", {
  id: text("id").primaryKey(),
  classId: text("class_id")
    .notNull()
    .references(() => classes.id, { onDelete: "cascade" }),
  createdBy: text("created_by").notNull(),
  lessons: text("lessons").notNull(),
  due: text("due").notNull(),
  createdAt: integer("created_at").notNull(),
});

/** A class round robin; its players and results live in cs_class_games. */
export const tournaments = sqliteTable("cs_class_tournaments", {
  id: text("id").primaryKey(),
  classId: text("class_id")
    .notNull()
    .references(() => classes.id, { onDelete: "cascade" }),
  createdBy: text("created_by").notNull(),
  createdAt: integer("created_at").notNull(),
});

/** A turn-based game between two classmates. `moves` is space-separated SAN from the start position. */
export const classGames = sqliteTable("cs_class_games", {
  id: text("id").primaryKey(),
  classId: text("class_id")
    .notNull()
    .references(() => classes.id, { onDelete: "cascade" }),
  tournamentId: text("tournament_id"),
  whiteId: text("white_id").notNull(),
  blackId: text("black_id").notNull(),
  moves: text("moves").notNull().default(""),
  /** active | over */
  status: text("status").notNull(),
  /** 1-0 | 0-1 | 1/2-1/2, once over. */
  result: text("result"),
  reason: text("reason"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

/** Anonymous usage events: an install id (random, per device), never a user id, name or email. */
export const events = sqliteTable("cs_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  at: integer("at").notNull(),
  install: text("install").notNull(),
  name: text("name").notNull(),
  lesson: text("lesson"),
  step: integer("step"),
  value: integer("value"),
  platform: text("platform").notNull(),
  appVersion: text("app_version").notNull(),
});

/** Extra learners under one parent account. The account's own progress stays the first profile. */
export const children = sqliteTable("cs_children", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  avatar: text("avatar").notNull(),
  createdAt: integer("created_at").notNull(),
});

/** A child profile's progress, in the same shape and with the same checks as cs_progress. */
export const childProgress = sqliteTable("cs_child_progress", {
  childId: text("child_id").primaryKey(),
  data: text("data").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

/** Weekly parent summary opt-ins: by email (the account email) and/or push (an Expo push token). */
export const weeklySummary = sqliteTable("cs_weekly_summary", {
  userId: text("user_id").primaryKey(),
  email: integer("email", { mode: "boolean" }).notNull().default(false),
  pushToken: text("push_token"),
  lang: text("lang").notNull().default("en"),
  /** Puzzles solved at the last summary, so the next one can show the week's count. */
  lastPuzzles: integer("last_puzzles").notNull().default(0),
  /** Day (YYYY-MM-DD) of the last summary sent. */
  lastSent: text("last_sent"),
});

/** Endgame tablebase answers, cached so each position is asked of Lichess once. */
export const tablebase = sqliteTable("cs_tablebase", {
  fen: text("fen").primaryKey(),
  move: text("move"),
  category: text("category").notNull(),
});

/** Each lesson's key idea (the flashcard), seeded with the course. English; translations live in cs_course_text. */
export const lessonIdeas = sqliteTable("cs_lesson_ideas", {
  lessonId: text("lesson_id").primaryKey(),
  idea: text("idea").notNull(),
});

/** Best board-vision score per learner, game and local day. */
export const visionScores = sqliteTable(
  "cs_vision_scores",
  {
    userId: text("user_id").notNull(),
    game: text("game").notNull(),
    day: text("day").notNull(),
    score: integer("score").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.game, t.day] })],
);

/** Learners who chose not to appear on class leaderboards. */
export const leaderboardHidden = sqliteTable("cs_leaderboard_hidden", {
  userId: text("user_id").primaryKey(),
});

/** Translated course words, one row per language and unit/lesson ("unit:<id>", "lesson:<id>", "soon:<id>"). */
export const courseText = sqliteTable(
  "cs_course_text",
  {
    lang: text("lang").notNull(),
    id: text("id").notNull(),
    data: text("data").notNull(),
  },
  (t) => [primaryKey({ columns: [t.lang, t.id] })],
);

/** Recorded coach lines: one public audio URL per coach and spoken line (key = voiceKey(text)). */
export const voiceClips = sqliteTable(
  "cs_voice_clips",
  {
    coach: text("coach").notNull(),
    key: text("key").notNull(),
    url: text("url").notNull(),
  },
  (t) => [primaryKey({ columns: [t.coach, t.key] })],
);

/** Glicko-2 playing rating and adapted bot strengths per learner (the account, or one of its children). */
export const ratings = sqliteTable("cs_ratings", {
  learnerId: text("learner_id").primaryKey(),
  userId: text("user_id").notNull(),
  /** `Ratings` from @chessschool/design, as JSON. */
  data: text("data").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

/** Results already counted, so a retried game or puzzle attempt changes the rating once. */
export const ratingEvents = sqliteTable(
  "cs_rating_events",
  {
    learnerId: text("learner_id").notNull(),
    event: text("event").notNull(),
    userId: text("user_id").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.learnerId, t.event] })],
);

/** The rating after each counted result, for the Profile chart (one row per cs_rating_events row). */
export const ratingHistory = sqliteTable(
  "cs_rating_history",
  {
    learnerId: text("learner_id").notNull(),
    event: text("event").notNull(),
    userId: text("user_id").notNull(),
    rating: integer("rating").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.learnerId, t.event] })],
);

/* ---------- Phase 3 track D: share cards, challenges, invites ---------- */

/** A share card's content (numbers and short words only). `name` is a first name the learner chose to show, never a child's. */
export const shares = sqliteTable("cs_shares", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  lang: text("lang").notNull(),
  data: text("data").notNull(),
  avatar: text("avatar").notNull(),
  name: text("name"),
  /** The account that made it (null for a guest), so account deletion removes it. */
  userId: text("user_id"),
  createdAt: integer("created_at").notNull(),
});

/** Challenge-a-friend links. `blackSeat` is the hash of the friend's seat token (the friend needs no account). */
export const challenges = sqliteTable("cs_challenges", {
  code: text("code").primaryKey(),
  creatorId: text("creator_id").notNull(),
  kind: text("kind").notNull(),
  puzzleId: text("puzzle_id"),
  name: text("name"),
  avatar: text("avatar").notNull(),
  creatorResult: text("creator_result"),
  friendResult: text("friend_result"),
  blackSeat: text("black_seat"),
  moves: text("moves").notNull().default(""),
  status: text("status").notNull(),
  result: text("result"),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
});

/** One invite code per account. */
export const invites = sqliteTable("cs_invites", {
  code: text("code").primaryKey(),
  userId: text("user_id").notNull().unique(),
  createdAt: integer("created_at").notNull(),
});

/** Who accepted whose invite (one per invited account) and when it paid out. */
export const inviteAccepts = sqliteTable("cs_invite_accepts", {
  invitedId: text("invited_id").primaryKey(),
  inviterId: text("inviter_id").notNull(),
  createdAt: integer("created_at").notNull(),
  rewardedAt: integer("rewarded_at"),
  /** False when the inviter was over the monthly cap, so only the friend was paid. */
  inviterRewarded: integer("inviter_rewarded", { mode: "boolean" }).notNull().default(false),
});

/** Streak freezes earned from invites and not yet moved into the learner's streak. */
export const freezeBank = sqliteTable("cs_freeze_bank", {
  userId: text("user_id").primaryKey(),
  banked: integer("banked").notNull().default(0),
});

/** Idempotent bootstrap; this schema is new and owns only cs_* tables. */
/** Coach explanations, keyed by a hash of the engine facts + coach + language. Holds no user data. */
export const coachCache = sqliteTable("cs_coach_cache", {
  key: text("key").primaryKey(),
  texts: text("texts").notNull(),
  provider: text("provider").notNull(),
  createdAt: integer("created_at").notNull(),
});

/** Coach explanations asked per learner per day, for the daily caps. */
export const coachUsage = sqliteTable(
  "cs_coach_usage",
  {
    userId: text("user_id").notNull(),
    day: text("day").notNull(),
    count: integer("count").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day] })],
);

/** Board scans asked per learner per day, for the daily caps. The image itself is never stored. */
export const scanUsage = sqliteTable(
  "cs_scan_usage",
  {
    userId: text("user_id").notNull(),
    day: text("day").notNull(),
    count: integer("count").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day] })],
);

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
  `CREATE TABLE IF NOT EXISTS cs_course_drafts (
    lesson_id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_by TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS cs_course_versions (
    id TEXT PRIMARY KEY,
    version TEXT NOT NULL,
    data TEXT NOT NULL,
    note TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS cs_course_versions_at ON cs_course_versions (created_at)`,
  `CREATE TABLE IF NOT EXISTS cs_reports (
    id TEXT PRIMARY KEY,
    class_id TEXT NOT NULL,
    reporter_id TEXT NOT NULL,
    reported_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    note TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS cs_blocks (
    blocker_id TEXT NOT NULL,
    blocked_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (blocker_id, blocked_id)
  )`,
  `CREATE TABLE IF NOT EXISTS cs_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at INTEGER NOT NULL,
    install TEXT NOT NULL,
    name TEXT NOT NULL,
    lesson TEXT,
    step INTEGER,
    value INTEGER,
    platform TEXT NOT NULL,
    app_version TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS cs_events_at ON cs_events (at)`,
  `CREATE TABLE IF NOT EXISTS cs_children (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    avatar TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS cs_children_user ON cs_children (user_id)`,
  `CREATE TABLE IF NOT EXISTS cs_child_progress (
    child_id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS cs_weekly_summary (
    user_id TEXT PRIMARY KEY,
    email INTEGER NOT NULL DEFAULT 0,
    push_token TEXT,
    lang TEXT NOT NULL DEFAULT 'en',
    last_puzzles INTEGER NOT NULL DEFAULT 0,
    last_sent TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS cs_tablebase (
    fen TEXT PRIMARY KEY,
    move TEXT,
    category TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS cs_coach_cache (
    key TEXT PRIMARY KEY,
    texts TEXT NOT NULL,
    provider TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS cs_scan_usage (
    user_id TEXT NOT NULL,
    day TEXT NOT NULL,
    count INTEGER NOT NULL,
    PRIMARY KEY (user_id, day)
  )`,
  `CREATE TABLE IF NOT EXISTS cs_coach_usage (
    user_id TEXT NOT NULL,
    day TEXT NOT NULL,
    count INTEGER NOT NULL,
    PRIMARY KEY (user_id, day)
  )`,
  `CREATE TABLE IF NOT EXISTS cs_lesson_ideas (
    lesson_id TEXT PRIMARY KEY,
    idea TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS cs_vision_scores (
    user_id TEXT NOT NULL,
    game TEXT NOT NULL,
    day TEXT NOT NULL,
    score INTEGER NOT NULL,
    PRIMARY KEY (user_id, game, day)
  )`,
  `CREATE TABLE IF NOT EXISTS cs_leaderboard_hidden (
    user_id TEXT PRIMARY KEY
  )`,
  `CREATE TABLE IF NOT EXISTS cs_course_text (
    lang TEXT NOT NULL,
    id TEXT NOT NULL,
    data TEXT NOT NULL,
    PRIMARY KEY (lang, id)
  )`,
  `CREATE TABLE IF NOT EXISTS cs_ratings (
    learner_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    data TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS cs_ratings_user ON cs_ratings (user_id)`,
  `CREATE TABLE IF NOT EXISTS cs_rating_events (
    learner_id TEXT NOT NULL,
    event TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (learner_id, event)
  )`,
  `CREATE INDEX IF NOT EXISTS cs_rating_events_user ON cs_rating_events (user_id)`,
  `CREATE TABLE IF NOT EXISTS cs_rating_history (
    learner_id TEXT NOT NULL,
    event TEXT NOT NULL,
    user_id TEXT NOT NULL,
    rating INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (learner_id, event)
  )`,
  `CREATE INDEX IF NOT EXISTS cs_rating_history_user ON cs_rating_history (user_id)`,
  `CREATE TABLE IF NOT EXISTS cs_voice_clips (
    coach TEXT NOT NULL,
    key TEXT NOT NULL,
    url TEXT NOT NULL,
    PRIMARY KEY (coach, key)
  )`,
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
  `CREATE TABLE IF NOT EXISTS cs_class_homework (
    id TEXT PRIMARY KEY,
    class_id TEXT NOT NULL REFERENCES cs_classes(id) ON DELETE CASCADE,
    created_by TEXT NOT NULL,
    lessons TEXT NOT NULL,
    due TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS cs_class_homework_class ON cs_class_homework (class_id)`,
  `CREATE TABLE IF NOT EXISTS cs_class_tournaments (
    id TEXT PRIMARY KEY,
    class_id TEXT NOT NULL REFERENCES cs_classes(id) ON DELETE CASCADE,
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS cs_class_games (
    id TEXT PRIMARY KEY,
    class_id TEXT NOT NULL REFERENCES cs_classes(id) ON DELETE CASCADE,
    tournament_id TEXT,
    white_id TEXT NOT NULL,
    black_id TEXT NOT NULL,
    moves TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL,
    result TEXT,
    reason TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS cs_class_games_class ON cs_class_games (class_id)`,
  `CREATE INDEX IF NOT EXISTS cs_class_games_white ON cs_class_games (white_id)`,
  `CREATE INDEX IF NOT EXISTS cs_class_games_black ON cs_class_games (black_id)`,
  `CREATE TABLE IF NOT EXISTS cs_shares (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    lang TEXT NOT NULL,
    data TEXT NOT NULL,
    avatar TEXT NOT NULL,
    name TEXT,
    user_id TEXT,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS cs_shares_user ON cs_shares (user_id)`,
  `CREATE TABLE IF NOT EXISTS cs_challenges (
    code TEXT PRIMARY KEY,
    creator_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    puzzle_id TEXT,
    name TEXT,
    avatar TEXT NOT NULL,
    creator_result TEXT,
    friend_result TEXT,
    black_seat TEXT,
    moves TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL,
    result TEXT,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS cs_challenges_creator ON cs_challenges (creator_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS cs_invites (
    code TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS cs_invite_accepts (
    invited_id TEXT PRIMARY KEY,
    inviter_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    rewarded_at INTEGER,
    inviter_rewarded INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS cs_invite_accepts_inviter ON cs_invite_accepts (inviter_id)`,
  `CREATE TABLE IF NOT EXISTS cs_freeze_bank (
    user_id TEXT PRIMARY KEY,
    banked INTEGER NOT NULL DEFAULT 0
  )`,
  // Over-the-air updates (packages/ota-server owns this table).
  ...OTA_SCHEMA_SQL,
];
