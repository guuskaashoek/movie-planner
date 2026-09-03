import { redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { apiKeys } from "@/lib/db/schema";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getSessionActor } from "@/lib/authz";
import { getCalendarFeed, publicBaseUrl } from "@/lib/films";
import { TOOLS } from "@/lib/mcp/tools";
import { SettingsClient } from "./SettingsClient";

export const metadata = { title: "Settings · Film Calendar" };

export default async function SettingsPage() {
  const actor = await getSessionActor();
  if (!actor) redirect("/");

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

  const calendar = await getCalendarFeed(actor);

  return (
    <SettingsClient
      account={{
        name: actor.name,
        email: actor.email,
        role: actor.role,
        isAdmin: actor.isAdmin,
      }}
      mcpUrl={`${publicBaseUrl()}/api/mcp`}
      calendar={calendar}
      initialKeys={keys.map((k) => ({
        ...k,
        createdAt: Number(k.createdAt),
        lastUsedAt: k.lastUsedAt ? Number(k.lastUsedAt) : null,
      }))}
      tools={TOOLS.filter((t) => !t.adminOnly || actor.isAdmin).map((t) => ({
        name: t.name,
        title: t.title,
        description: t.description,
        adminOnly: t.adminOnly ?? false,
      }))}
    />
  );
}
