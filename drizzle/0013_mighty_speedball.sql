CREATE TABLE `github_installations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`installation_id` integer NOT NULL,
	`account_login` text NOT NULL,
	`account_type` text NOT NULL,
	`repository_selection` text NOT NULL,
	`permissions` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `github_installations_installation_id_unique` ON `github_installations` (`installation_id`);--> statement-breakpoint
CREATE TABLE `repo_permissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspace_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`repo_full_name` text NOT NULL,
	`permission` text NOT NULL,
	`can_dispatch` integer DEFAULT false NOT NULL,
	`checked_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `repo_permissions_workspace_user_repo_idx` ON `repo_permissions` (`workspace_id`,`user_id`,`repo_full_name`);--> statement-breakpoint
CREATE TABLE `workspace_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspace_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`role` text NOT NULL,
	`joined_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_members_workspace_user_idx` ON `workspace_members` (`workspace_id`,`user_id`);--> statement-breakpoint
ALTER TABLE `workspaces` ADD `github_installation_id` integer;--> statement-breakpoint
INSERT OR IGNORE INTO `workspace_members` (`workspace_id`, `user_id`, `role`, `joined_at`)
SELECT `id`, `user_id`, 'owner', `created_at`
FROM `workspaces`
WHERE `user_id` IS NOT NULL;
