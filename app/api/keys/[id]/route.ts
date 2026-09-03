import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { apiKeys } from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { getSessionActor } from "@/lib/authz";

type RouteParams = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const actor = await getSessionActor();
  if (!actor) return new NextResponse("Unauthorized", { status: 401 });

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id)) return new NextResponse("Invalid id", { status: 400 });

  const [key] = await db
    .select({ id: apiKeys.id, userId: apiKeys.userId })
    .from(apiKeys)
    .where(and(eq(apiKeys.id, id), isNull(apiKeys.revokedAt)))
    .limit(1);

  if (!key) return new NextResponse("Not found", { status: 404 });

  // Admins may revoke anyone's key; everyone else only their own.
  if (key.userId !== actor.userId && !actor.isAdmin) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Revoked rather than deleted, so the hash can never be reissued.
  await db.update(apiKeys).set({ revokedAt: new Date() }).where(eq(apiKeys.id, id));

  return new NextResponse(null, { status: 204 });
}
