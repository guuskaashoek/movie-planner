import { NextRequest, NextResponse } from "next/server";
import { getSessionActor } from "@/lib/authz";
import { ServiceError, setPoll } from "@/lib/films";

type RouteParams = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const actor = await getSessionActor();
  if (!actor) return new NextResponse("Unauthorized", { status: 401 });

  const { id: idParam } = await params;
  const filmId = Number(idParam);
  if (!Number.isInteger(filmId)) {
    return new NextResponse("Invalid film ID", { status: 400 });
  }

  try {
    const json = await req.json();
    // setPoll allows the film's creator and any admin.
    const poll = await setPoll(actor, filmId, {
      allowMultiVote: Boolean(json.allowMultiVote),
      options: Array.isArray(json.options) ? json.options : [],
    });
    return NextResponse.json({ poll });
  } catch (err) {
    if (err instanceof ServiceError) {
      return new NextResponse(err.message, { status: err.status });
    }
    console.error("[films/:id/poll]", err);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
