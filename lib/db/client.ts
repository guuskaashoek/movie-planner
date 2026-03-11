import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

const sqlite = new Database("db.sqlite");

// Idempotent migrations
try { sqlite.prepare("ALTER TABLE films ADD COLUMN invite_token TEXT").run(); } catch {}
try { sqlite.prepare("ALTER TABLE attendees ADD COLUMN type TEXT NOT NULL DEFAULT 'going'").run(); } catch {}

// Migration tracker for one-time data migrations
sqlite.prepare("CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at INTEGER)").run();

// One-time: all legacy attendees become 'interested' (before screening-specific attendance was introduced)
try {
  const m1 = sqlite.prepare("SELECT name FROM _migrations WHERE name = 'seed_attendees_as_interested'").get();
  if (!m1) {
    sqlite.prepare("UPDATE attendees SET type = 'interested'").run();
    sqlite.prepare("INSERT INTO _migrations (name, applied_at) VALUES ('seed_attendees_as_interested', ?)").run(Date.now());
  }
} catch {}

export const db = drizzle(sqlite);

