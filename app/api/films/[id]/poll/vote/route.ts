import { NextRequest, NextResponse } from "next/server";
import { getSessionActor } from "@/lib/authz";
import { ServiceError, voteOnPoll } from "@/lib/films";

type RouteParams = { params: Promise<{ id: string }> };

async function vote(req: NextRequest, params: RouteParams["params"], remove: boolean) {
  const actor = await getSessionActor();
  if (!actor) return new NextResponse("Unauthorized", { status: 401 });

  const { id: idParam } = await params;
  const filmId = Number(idParam);
  if (!Number.isInteger(filmId)) return new NextResponse("Invalid film ID", { status: 400 });

  try {
    const json = await req.json();
    const optionId = Number(json.optionId);
    if (!Number.isInteger(optionId)) return new NextResponse("Invalid body", { status: 400 });

    const poll = await voteOnPoll(actor, filmId, optionId, { remove });
    return NextResponse.json({ poll });
  } catch (err) {
    if (err instanceof ServiceError) {
      return new NextResponse(err.message, { status: err.status });
    }
    console.error("[films/:id/poll/vote]", err);
    return new NextResponse("Internal server error", { status: 500 });
  }
}

// Add a vote (single-choice polls replace any previous vote).
export async function POST(req: NextRequest, { params }: RouteParams) {
  return vote(req, params, false);
}

// Remove a vote.
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  return vote(req, params, true);
}
