import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

const sqlite = new Database("db.sqlite");

// Idempotent migrations
try { sqlite.prepare("ALTER TABLE films ADD COLUMN invite_token TEXT").run(); } catch {}
try { sqlite.prepare("ALTER TABLE attendees ADD COLUMN type TEXT NOT NULL DEFAULT 'going'").run(); } catch {}


export const db = drizzle(sqlite);

