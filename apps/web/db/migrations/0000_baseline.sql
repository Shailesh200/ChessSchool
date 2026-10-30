CREATE TABLE `analytics_events` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`props` text DEFAULT '{}' NOT NULL,
	`pathname` text,
	`user_id` text,
	`session_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `classes` (
	`id` text PRIMARY KEY NOT NULL,
	`semester_id` text NOT NULL,
	`title` text NOT NULL,
	`emoji` text DEFAULT '♟️' NOT NULL,
	`blurb` text DEFAULT '' NOT NULL,
	`difficulty` integer DEFAULT 1 NOT NULL,
	`exam_id` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`semester_id`) REFERENCES `semesters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `classes_semester_id_idx` ON `classes` (`semester_id`);--> statement-breakpoint
CREATE TABLE `game_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`fen` text NOT NULL,
	`pgn` text DEFAULT '' NOT NULL,
	`last_from` text,
	`last_to` text,
	`turn` text DEFAULT 'w' NOT NULL,
	`status` text DEFAULT 'waiting' NOT NULL,
	`result` text,
	`black_joined` integer DEFAULT 0 NOT NULL,
	`white_user_id` text,
	`black_user_id` text,
	`time_control_min` integer DEFAULT 10 NOT NULL,
	`white_ms` integer DEFAULT 600000 NOT NULL,
	`black_ms` integer DEFAULT 600000 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`white_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`black_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `homework_lessons` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`subtitle` text DEFAULT '' NOT NULL,
	`emoji` text DEFAULT '♟️' NOT NULL,
	`tag` text DEFAULT 'drill' NOT NULL,
	`xp` integer DEFAULT 20 NOT NULL,
	`steps` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `lesson_records` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`lesson_id` text NOT NULL,
	`mastery` real DEFAULT 0 NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_seen` integer DEFAULT 0 NOT NULL,
	`due_at` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `lesson_records_user_id_idx` ON `lesson_records` (`user_id`);--> statement-breakpoint
CREATE TABLE `lessons` (
	`id` text PRIMARY KEY NOT NULL,
	`class_id` text NOT NULL,
	`title` text NOT NULL,
	`subtitle` text DEFAULT '' NOT NULL,
	`emoji` text DEFAULT '♟️' NOT NULL,
	`tag` text DEFAULT 'drill' NOT NULL,
	`xp` integer DEFAULT 20 NOT NULL,
	`is_exam` integer DEFAULT 0 NOT NULL,
	`prerequisites` text DEFAULT '[]' NOT NULL,
	`steps` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `lessons_class_id_idx` ON `lessons` (`class_id`);--> statement-breakpoint
CREATE TABLE `oauth_accounts` (
	`provider` text NOT NULL,
	`provider_account_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`provider`, `provider_account_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `oauth_accounts_user_id_idx` ON `oauth_accounts` (`user_id`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`student_no` text NOT NULL,
	`enrolled_at` integer NOT NULL,
	`rank_title` text DEFAULT 'Novice' NOT NULL,
	`avatar_url` text,
	`goal` text,
	`house` text,
	`onboarded` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `progress` (
	`user_id` text PRIMARY KEY NOT NULL,
	`xp` integer DEFAULT 0 NOT NULL,
	`streak` integer DEFAULT 0 NOT NULL,
	`last_active_day` text,
	`daily_goal_xp` integer DEFAULT 50 NOT NULL,
	`graduated_classes` text DEFAULT '[]' NOT NULL,
	`data` text DEFAULT '{}' NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `semesters` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`blurb` text DEFAULT '' NOT NULL,
	`color` text DEFAULT '#5b5bd6' NOT NULL,
	`stage` text DEFAULT 'elementary' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_expires_at_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text,
	`name` text NOT NULL,
	`role` text DEFAULT 'student' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `web_vitals` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`value` real NOT NULL,
	`rating` text NOT NULL,
	`pathname` text NOT NULL,
	`connection` text,
	`user_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
