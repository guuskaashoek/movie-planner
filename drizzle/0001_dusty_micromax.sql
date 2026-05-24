PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_films` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_by` integer NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`date` text,
	`release_date` text,
	`start_time` text,
	`end_time` text,
	`poster_url` text,
	`formats` text,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_films`("id", "created_by", "title", "description", "date", "release_date", "start_time", "end_time", "poster_url", "formats", "created_at") SELECT "id", "created_by", "title", "description", "date", "release_date", "start_time", "end_time", "poster_url", "formats", "created_at" FROM `films`;--> statement-breakpoint
DROP TABLE `films`;--> statement-breakpoint
ALTER TABLE `__new_films` RENAME TO `films`;--> statement-breakpoint
PRAGMA foreign_keys=ON;