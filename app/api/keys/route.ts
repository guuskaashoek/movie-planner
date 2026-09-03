import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { apiKeys } from "@/lib/db/schema";
import { and, desc, eq, isNull } from "drizzle-orm";
import { generateApiKey, getSessionActor } from "@/lib/authz";

/**
 * Personal access tokens for MCP clients. These are managed from /settings and
 * are always scoped to the signed-in user; the key inherits that user's role,
 * so an admin's key can drive the admin-only MCP tools.
 */

export async function GET() {
  const actor = await getSessionActor();
  if (!actor) return new NextResponse("Unauthorized", { status: 401 });

  const keys = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      tokenPrefix: apiKeys.tokenPrefix,
      lastUsedAt: apiKeys.lastUsedAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, actor.userId), isNull(apiKeys.revokedAt)))
    .orderBy(desc(apiKeys.createdAt));

  return NextResponse.json({
    keys: keys.map((k) => ({
      ...k,
      createdAt: Number(k.createdAt),
      lastUsedAt: k.lastUsedAt ? Number(k.lastUsedAt) : null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const actor = await getSessionActor();
  if (!actor) return new NextResponse("Unauthorized", { status: 401 });

  let name = "MCP key";
  try {
    const json = await req.json();
    if (typeof json?.name === "string" && json.name.trim()) {
      name = json.name.trim().slice(0, 60);
    }
  } catch {
    // Body is optional.
  }

  const existing = await db
    .select({ id: apiKeys.id })
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, actor.userId), isNull(apiKeys.revokedAt)));

  if (existing.length >= 10) {
    return new NextResponse("You already have 10 active keys. Revoke one first.", {
      status: 400,
    });
  }

  const { token, tokenHash, tokenPrefix } = generateApiKey();

  const [created] = await db
    .insert(apiKeys)
    .values({ userId: actor.userId, name, tokenHash, tokenPrefix })
    .returning();

  // The plaintext token is returned exactly once and never stored.
  return NextResponse.json(
    {
      key: {
        id: created.id,
        name: created.name,
        tokenPrefix: created.tokenPrefix,
        createdAt: Number(created.createdAt),
        lastUsedAt: null,
      },
      token,
    },
    { status: 201 }
  );
}
