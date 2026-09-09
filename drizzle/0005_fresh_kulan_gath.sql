CREATE TABLE `film_tickets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`film_id` integer NOT NULL,
	`label` text NOT NULL,
	`image_url` text NOT NULL,
	`created_by` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`film_id`) REFERENCES `films`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
