-- One-off: password_reset_tokens (matches apps/web/db/schema.ts).
-- Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS `password_reset_tokens_user_id_idx` ON `password_reset_tokens` (`user_id`);
CREATE INDEX IF NOT EXISTS `password_reset_tokens_expires_at_idx` ON `password_reset_tokens` (`expires_at`);
