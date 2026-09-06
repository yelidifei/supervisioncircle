CREATE TABLE `circles` (
	`id` text PRIMARY KEY NOT NULL,
	`admin_hash` text NOT NULL,
	`share_hash` text NOT NULL,
	`payload` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
