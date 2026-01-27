import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { films } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

const updateSchema = z.object({
  title: z.string().optional(),
  description: z.string().nullable().optional(),
  date: z.string().optional(),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  isOnMainBoard: z.boolean().optional(),
});

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  // @ts-expect-error added in auth callback
  const userId: number | undefined = session?.user?.id;
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (Number.isNaN(id)) {
    return new NextResponse("Invalid id", { status: 400 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(parsed.error.format(), { status: 400 });
  }

  const updateData: Record<string, unknown> = { ...parsed.data };

  if (parsed.data.isOnMainBoard === true) {
    updateData.addedToMainBoardAt = Date.now();
  }

  const [updated] = await db
    .update(films)
    .set(updateData)
    .where(and(eq(films.id, id), eq(films.userId, userId)))
    .returning();

  if (!updated) {
    return new NextResponse("Not found", { status: 404 });
  }

  return NextResponse.json({ film: updated });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  // @ts-expect-error added in auth callback
  const userId: number | undefined = session?.user?.id;
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (Number.isNaN(id)) {
    return new NextResponse("Invalid id", { status: 400 });
  }

  await db
    .delete(films)
    .where(and(eq(films.id, id), eq(films.userId, userId)));

  return new NextResponse(null, { status: 204 });
}

