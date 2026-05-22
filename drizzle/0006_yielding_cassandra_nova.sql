CREATE TABLE `score_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspace_id` integer NOT NULL,
	`repo_full_name` text NOT NULL,
	`score` real NOT NULL,
	`grade` text NOT NULL,
	`pillars` text NOT NULL,
	`synced_at` text NOT NULL
);
