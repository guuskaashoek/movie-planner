import { NextRequest, NextResponse } from "next/server";
import { getSessionActor } from "@/lib/authz";
import { isOwnStorageUrl } from "@/lib/images";
import { ServiceError, createFilm, listFilms } from "@/lib/films";

function fail(err: unknown) {
  if (err instanceof ServiceError) {
    return new NextResponse(err.message, { status: err.status });
  }
  console.error("[films]", err);
  return new NextResponse("Internal server error", { status: 500 });
}

export async function GET(req: NextRequest) {
  const actor = await getSessionActor();
  if (!actor) return new NextResponse("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);

  try {
    const result = await listFilms(actor, {
      scope: (searchParams.get("scope") as "all" | "upcoming" | "past" | "mine") ?? "all",
      query: searchParams.get("query"),
      owner: searchParams.get("owner"),
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : 100,
      offset: searchParams.get("offset") ? Number(searchParams.get("offset")) : 0,
    });
    return NextResponse.json(result);
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: NextRequest) {
  const actor = await getSessionActor();
  if (!actor) return new NextResponse("Unauthorized", { status: 401 });

  try {
    const json = await req.json();

    // From the web UI a poster is always a file that went through /api/upload.
    // Importing a poster from an arbitrary link is an MCP-only feature.
    if (json.posterUrl && !isOwnStorageUrl(String(json.posterUrl))) {
      throw new ServiceError("Upload the poster file instead of linking to it", 400);
    }

    const film = await createFilm(actor, {
      title: json.title,
      description: json.description ?? null,
      date: json.date ?? null,
      releaseDate: json.releaseDate ?? null,
      startTime: json.startTime ?? null,
      endTime: json.endTime ?? null,
      formats: json.formats ?? null,
      posterUrl: json.posterUrl ?? null,
      allowMultiVote: json.allowMultiVote ?? false,
    });

    return NextResponse.json({ film }, { status: 201 });
  } catch (err) {
    return fail(err);
  }
}
