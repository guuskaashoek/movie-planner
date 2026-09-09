ALTER TABLE `films` ADD `backdrop_url` text;--> statement-breakpoint
ALTER TABLE `films` ADD `is_major_release` integer DEFAULT false NOT NULL;