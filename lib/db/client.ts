import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

const sqlite = new Database("db.sqlite");

// Enforce ON DELETE CASCADE (off by default in SQLite)
sqlite.pragma("foreign_keys = ON");

// Idempotent migrations
try { sqlite.prepare("ALTER TABLE films ADD COLUMN invite_token TEXT").run(); } catch {}
try { sqlite.prepare("ALTER TABLE attendees ADD COLUMN type TEXT NOT NULL DEFAULT 'going'").run(); } catch {}
try { sqlite.prepare("ALTER TABLE films ADD COLUMN allow_multi_vote INTEGER NOT NULL DEFAULT 0").run(); } catch {}

sqlite.prepare(`
  CREATE TABLE IF NOT EXISTS poll_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    film_id INTEGER NOT NULL REFERENCES films(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    start_time TEXT,
    end_time TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
  )
`).run();

sqlite.prepare(`
  CREATE TABLE IF NOT EXISTS poll_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    option_id INTEGER NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
  )
`).run();

sqlite.prepare(`
  CREATE UNIQUE INDEX IF NOT EXISTS poll_votes_option_user_unique
  ON poll_votes (option_id, user_id)
`).run();


export const db = drizzle(sqlite);

