CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspace_id` integer NOT NULL,
	`repo_full_name` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`provider` text,
	`provider_ref` text,
	`notes` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	`dispatched_at` text,
	`completed_at` text
);
