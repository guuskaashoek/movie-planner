import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

const sqlite = new Database("db.sqlite");

// Add invite_token column if it doesn't exist yet (idempotent migration)
try {
  sqlite.prepare("ALTER TABLE films ADD COLUMN invite_token TEXT").run();
} catch {}

export const db = drizzle(sqlite);

