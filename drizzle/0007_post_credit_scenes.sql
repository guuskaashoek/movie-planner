-- Existing films default to 'unknown'. Counts and the note stay null; no rows are rewritten.
ALTER TABLE `films` ADD `post_credit_status` text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE `films` ADD `mid_credit_count` integer;--> statement-breakpoint
ALTER TABLE `films` ADD `end_credit_count` integer;--> statement-breakpoint
ALTER TABLE `films` ADD `post_credit_note` text;