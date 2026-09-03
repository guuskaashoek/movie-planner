import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { db } from "@/lib/db/client";
import { apiKeys, users } from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { auth } from "@/lib/auth";

/**
 * Who is performing an action. Requests arrive either from the web UI
 * (NextAuth session) or from an MCP client (bearer API key); everything
 * downstream only cares about the resolved actor.
 */
export type Actor = {
  userId: number;
  email: string;
  name: string | null;
  role: "user" | "admin";
  isAdmin: boolean;
  via: "session" | "apiKey";
};

/**
 * Emails listed in ADMIN_EMAILS are always admins, even before anyone has
 * flipped their role in the database. This is how the first admin is created.
 */
export function bootstrapAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function resolveRole(
  email: string | null | undefined,
  dbRole: string | null | undefined
): "user" | "admin" {
  if (dbRole === "admin") return "admin";
  if (email && bootstrapAdminEmails().includes(email.toLowerCase())) return "admin";
  return "user";
}

// ---------------------------------------------------------------------------
// API keys
// ---------------------------------------------------------------------------

export const API_KEY_PREFIX = "mp_";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateApiKey(): { token: string; tokenHash: string; tokenPrefix: string } {
  const token = `${API_KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
  return {
    token,
    tokenHash: hashToken(token),
    tokenPrefix: token.slice(0, API_KEY_PREFIX.length + 6),
  };
}

/**
 * Look up the owner of a bearer token. Hash comparison is constant-time so a
 * token cannot be recovered by timing the lookup.
 */
async function actorFromToken(token: string): Promise<Actor | null> {
  const trimmed = token.trim();
  if (!trimmed) return null;

  const tokenHash = hashToken(trimmed);

  const [row] = await db
    .select({
      keyId: apiKeys.id,
      keyHash: apiKeys.tokenHash,
      userId: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
    })
    .from(apiKeys)
    .innerJoin(users, eq(apiKeys.userId, users.id))
    .where(and(eq(apiKeys.tokenHash, tokenHash), isNull(apiKeys.revokedAt)))
    .limit(1);

  if (!row) return null;

  const a = Buffer.from(row.keyHash, "utf8");
  const b = Buffer.from(tokenHash, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  // Best-effort "last used" bookkeeping; never fail the request over it.
  try {
    await db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, row.keyId));
  } catch {
    // ignore
  }

  const role = resolveRole(row.email, row.role);
  return {
    userId: row.userId,
    email: row.email,
    name: row.name,
    role,
    isAdmin: role === "admin",
    via: "apiKey",
  };
}

/**
 * Extract a bearer token from the request. `Authorization: Bearer <token>` is
 * the standard path; `?token=` exists for clients that cannot set headers.
 */
export function readBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (header) {
    // Clients differ: some send "Bearer <token>", some the bare token, and some
    // prepend "Bearer " to a value the user already typed with the prefix.
    let value = header.trim();
    for (let i = 0; i < 3; i++) {
      const match = /^Bearer\s+(.+)$/i.exec(value);
      if (!match) break;
      value = match[1].trim();
    }
    if (value) return value;
  }

  const xApiKey = req.headers.get("x-api-key");
  if (xApiKey) return xApiKey.trim();

  try {
    const token = new URL(req.url).searchParams.get("token");
    if (token) return token.trim();
  } catch {
    // ignore malformed URLs
  }

  return null;
}

/** Resolve the actor for an API-key authenticated request. */
export async function getApiKeyActor(req: Request): Promise<Actor | null> {
  const token = readBearerToken(req);
  if (!token) return null;
  return actorFromToken(token);
}

/** Resolve the actor for a NextAuth browser session. */
export async function getSessionActor(): Promise<Actor | null> {
  const session = await auth();
  // @ts-expect-error id is added in the auth callback
  const userId: number | undefined = session?.user?.id;
  if (!userId) return null;

  const [row] = await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!row) return null;

  const role = resolveRole(row.email, row.role);
  return {
    userId: row.id,
    email: row.email,
    name: row.name,
    role,
    isAdmin: role === "admin",
    via: "session",
  };
}

/**
 * Resolve the actor from either auth mechanism. A bearer token wins when
 * present, so an MCP call is never silently attributed to a browser session.
 */
export async function getActor(req?: Request): Promise<Actor | null> {
  if (req && readBearerToken(req)) {
    return getApiKeyActor(req);
  }
  return getSessionActor();
}

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

/** Admins manage every film; everyone else manages only their own. */
export function canManageFilm(
  actor: Actor,
  film: { createdBy: number } | null | undefined
): boolean {
  if (!film) return false;
  return actor.isAdmin || film.createdBy === actor.userId;
}

/** A comment may be removed by its author, the film's creator, or an admin. */
export function canManageComment(
  actor: Actor,
  comment: { userId: number },
  film: { createdBy: number } | null | undefined
): boolean {
  if (actor.isAdmin) return true;
  if (comment.userId === actor.userId) return true;
  return film?.createdBy === actor.userId;
}
