import { sqliteTable, integer, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  name: text("name"),
  image: text("image"),
  googleId: text("google_id").notNull().unique(),
  // 'user' | 'admin'. Admins may manage every film, poll, comment and rating,
  // both in the web UI and over MCP.
  role: text("role").notNull().default("user"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(strftime('%s','now') * 1000)`),
});

// Personal access tokens used by MCP clients (Grok, Claude, ...). Only the
// SHA-256 hash is stored; the plaintext token is shown once at creation.
export const apiKeys = sqliteTable("api_keys", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  // First characters of the token, so a key stays recognisable in the UI.
  tokenPrefix: text("token_prefix").notNull(),
  lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
  revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(strftime('%s','now') * 1000)`),
});

export const films = sqliteTable("films", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  createdBy: integer("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  date: text("date"), // SCREENING date (Optional now)
  releaseDate: text("release_date"), // RELEASE date
  startTime: text("start_time"), // HH:mm
  endTime: text("end_time"), // HH:mm
  posterUrl: text("poster_url"),
  formats: text("formats"), // Comma separated: IMAX,4DX,3D,etc.
  // When tickets for this screening go on sale (YYYY-MM-DD + optional HH:mm).
  ticketsOnSaleDate: text("tickets_on_sale_date"),
  ticketsOnSaleTime: text("tickets_on_sale_time"),
  ticketsUrl: text("tickets_url"),
  inviteToken: text("invite_token").unique(),
  // When true, voters may pick more than one poll option.
  allowMultiVote: integer("allow_multi_vote", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(strftime('%s','now') * 1000)`),
});

// A poll option is a proposed screening slot (date + optional time range).
// Each row has a stable id; votes reference it. Deleting an option cascades
// to its votes, so removing + re-adding a slot never carries old votes over.
export const pollOptions = sqliteTable("poll_options", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  filmId: integer("film_id")
    .notNull()
    .references(() => films.id, { onDelete: "cascade" }),
  date: text("date").notNull(), // YYYY-MM-DD
  startTime: text("start_time"), // HH:mm
  endTime: text("end_time"), // HH:mm
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(strftime('%s','now') * 1000)`),
});

export const pollVotes = sqliteTable(
  "poll_votes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    optionId: integer("option_id")
      .notNull()
      .references(() => pollOptions.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(strftime('%s','now') * 1000)`),
  },
  (table) => ({
    optionUserUnique: uniqueIndex("poll_votes_option_user_unique").on(
      table.optionId,
      table.userId
    ),
  })
);

export const attendees = sqliteTable("attendees", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  filmId: integer("film_id")
    .notNull()
    .references(() => films.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // 'going' = attending a scheduled screening, 'interested' = wants to see the film
  type: text("type").notNull().default("going"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(strftime('%s','now') * 1000)`),
});

export const comments = sqliteTable("comments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  filmId: integer("film_id")
    .notNull()
    .references(() => films.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(strftime('%s','now') * 1000)`),
});

export const filmRatings = sqliteTable(
  "film_ratings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    filmId: integer("film_id")
      .notNull()
      .references(() => films.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(strftime('%s','now') * 1000)`),
  },
  (table) => ({
    filmUserUnique: uniqueIndex("film_ratings_film_user_unique").on(
      table.filmId,
      table.userId
    ),
  })
);

export const boardSettings = sqliteTable("board_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  name: text("name").notNull(),
  icsShareId: text("ics_share_id").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(strftime('%s','now') * 1000)`),
});
