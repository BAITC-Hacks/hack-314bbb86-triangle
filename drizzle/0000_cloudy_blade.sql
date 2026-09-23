CREATE TABLE `analyses` (
	`id` text PRIMARY KEY NOT NULL,
	`response_json` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scenarios` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`team` text NOT NULL,
	`decisions_json` text NOT NULL,
	`version` text NOT NULL,
	`score` real NOT NULL,
	`cost` integer NOT NULL,
	`share_id` text,
	`published` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scenarios_share_id_unique` ON `scenarios` (`share_id`);--> statement-breakpoint
CREATE INDEX `idx_scenarios_owner_updated` ON `scenarios` (`owner_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_scenarios_published_score` ON `scenarios` (`published`,`score`);--> statement-breakpoint
CREATE TABLE `usage` (
	`id` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL
);
