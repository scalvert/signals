CREATE TABLE `repo_context` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspace_id` integer NOT NULL,
	`repo_full_name` text NOT NULL,
	`context` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `repo_context_workspace_repo_idx` ON `repo_context` (`workspace_id`,`repo_full_name`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `signals` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `signals` ADD `dismissed_reason` text;--> statement-breakpoint
ALTER TABLE `signals` ADD `enriched_body` text;