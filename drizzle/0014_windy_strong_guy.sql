CREATE TABLE `dispatch_targets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspace_id` integer NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`config` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dispatch_targets_workspace_type_idx` ON `dispatch_targets` (`workspace_id`,`type`);--> statement-breakpoint
CREATE TABLE `task_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` integer NOT NULL,
	`workspace_id` integer NOT NULL,
	`dispatch_target_id` integer,
	`orchestrator` text NOT NULL,
	`runner` text NOT NULL,
	`status` text NOT NULL,
	`external_id` text,
	`external_url` text,
	`branch` text,
	`pr_url` text,
	`summary` text,
	`error` text,
	`raw_state` text,
	`dispatched_by_user_id` integer NOT NULL,
	`executed_by_identity` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`completed_at` text
);
