import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { comments, films } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getComments } from "@/lib/comments";
import { publishLiveEvent } from "@/lib/live";

type RouteParams = { params: Promise<{ id: string; commentId: string }> };

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  // @ts-expect-error added in auth callback
  const userId: number | undefined = session?.user?.id;
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { id: idParam, commentId: commentIdParam } = await params;
  const filmId = Number(idParam);
  const commentId = Number(commentIdParam);
  if (Number.isNaN(filmId) || Number.isNaN(commentId)) {
    return new NextResponse("Invalid id", { status: 400 });
  }

  const [comment] = await db
    .select()
    .from(comments)
    .where(and(eq(comments.id, commentId), eq(comments.filmId, filmId)))
    .limit(1);
  if (!comment) return new NextResponse("Not found", { status: 404 });

  const [film] = await db.select().from(films).where(eq(films.id, filmId)).limit(1);
  const isOwner = comment.userId === userId;
  const isCreator = film?.createdBy === userId;
  if (!isOwner && !isCreator) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  await db.delete(comments).where(eq(comments.id, commentId));

  const list = await getComments(filmId);
  publishLiveEvent({ topic: "comment", filmId });
  return NextResponse.json({ comments: list });
}
