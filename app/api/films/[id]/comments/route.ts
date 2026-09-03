import { NextRequest, NextResponse } from "next/server";
import { getSessionActor } from "@/lib/authz";
import { getComments } from "@/lib/comments";
import { ServiceError, addComment } from "@/lib/films";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id: idParam } = await params;
  const filmId = Number(idParam);
  if (!Number.isInteger(filmId)) return new NextResponse("Invalid film ID", { status: 400 });

  const list = await getComments(filmId);
  return NextResponse.json({ comments: list });
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const actor = await getSessionActor();
  if (!actor) return new NextResponse("Unauthorized", { status: 401 });

  const { id: idParam } = await params;
  const filmId = Number(idParam);
  if (!Number.isInteger(filmId)) return new NextResponse("Invalid film ID", { status: 400 });

  try {
    const json = await req.json();
    const comments = await addComment(actor, filmId, String(json.body ?? ""));
    return NextResponse.json({ comments }, { status: 201 });
  } catch (err) {
    if (err instanceof ServiceError) {
      return new NextResponse(err.message, { status: err.status });
    }
    console.error("[films/:id/comments]", err);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
