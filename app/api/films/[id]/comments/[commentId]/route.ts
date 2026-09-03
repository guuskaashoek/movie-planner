import { NextRequest, NextResponse } from "next/server";
import { getSessionActor } from "@/lib/authz";
import { ServiceError, deleteComment } from "@/lib/films";

type RouteParams = { params: Promise<{ id: string; commentId: string }> };

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const actor = await getSessionActor();
  if (!actor) return new NextResponse("Unauthorized", { status: 401 });

  const { id: idParam, commentId: commentIdParam } = await params;
  const filmId = Number(idParam);
  const commentId = Number(commentIdParam);
  if (!Number.isInteger(filmId) || !Number.isInteger(commentId)) {
    return new NextResponse("Invalid id", { status: 400 });
  }

  try {
    // Author, film creator, or any admin.
    const comments = await deleteComment(actor, filmId, commentId);
    return NextResponse.json({ comments });
  } catch (err) {
    if (err instanceof ServiceError) {
      return new NextResponse(err.message, { status: err.status });
    }
    console.error("[films/:id/comments/:commentId]", err);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
