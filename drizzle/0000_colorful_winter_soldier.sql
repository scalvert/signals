CREATE TABLE `pull_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspace_id` integer NOT NULL,
	`number` integer NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`author_login` text NOT NULL,
	`author_association` text NOT NULL,
	`repo_full_name` text NOT NULL,
	`is_draft` integer DEFAULT false NOT NULL,
	`ci_state` text DEFAULT 'unknown' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`synced_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `repos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspace_id` integer NOT NULL,
	`name` text NOT NULL,
	`full_name` text NOT NULL,
	`description` text,
	`url` text NOT NULL,
	`language` text,
	`stars` integer DEFAULT 0 NOT NULL,
	`forks` integer DEFAULT 0 NOT NULL,
	`open_issues` integer DEFAULT 0 NOT NULL,
	`open_prs` integer DEFAULT 0 NOT NULL,
	`last_commit_at` text,
	`last_release_at` text,
	`has_ci` integer DEFAULT false NOT NULL,
	`has_license` integer DEFAULT false NOT NULL,
	`has_contributing` integer DEFAULT false NOT NULL,
	`score` real DEFAULT 0 NOT NULL,
	`grade` text DEFAULT 'F' NOT NULL,
	`triage` text DEFAULT 'critical' NOT NULL,
	`pillars` text NOT NULL,
	`synced_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `signals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspace_id` integer NOT NULL,
	`type` text NOT NULL,
	`severity` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`repo_full_name` text NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	`detected_at` text NOT NULL,
	`resolved_at` text
);
--> statement-breakpoint
CREATE TABLE `sync_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspace_id` integer NOT NULL,
	`status` text NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`repo_count` integer,
	`error` text
);
--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`sources` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspaces_slug_unique` ON `workspaces` (`slug`);