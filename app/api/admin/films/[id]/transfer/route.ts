import { NextRequest, NextResponse } from "next/server";
import { getSessionActor } from "@/lib/authz";
import { ServiceError, transferFilm } from "@/lib/films";

type RouteParams = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const actor = await getSessionActor();
  if (!actor) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;

  try {
    const json = await req.json();
    const film = await transferFilm(actor, Number(id), json.owner);
    return NextResponse.json({ film });
  } catch (err) {
    if (err instanceof ServiceError) {
      return new NextResponse(err.message, { status: err.status });
    }
    console.error("[admin/films/:id/transfer]", err);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
