CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`github_login` text NOT NULL,
	`name` text NOT NULL,
	`avatar_url` text NOT NULL,
	`access_token` text NOT NULL,
	`refresh_token` text,
	`token_expires_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_github_login_unique` ON `users` (`github_login`);--> statement-breakpoint
ALTER TABLE `workspaces` ADD `user_id` integer;