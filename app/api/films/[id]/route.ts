import { NextRequest, NextResponse } from "next/server";
import { getSessionActor } from "@/lib/authz";
import { isOwnStorageUrl } from "@/lib/images";
import { ServiceError, deleteFilm, getFilm, updateFilm } from "@/lib/films";

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

function fail(err: unknown) {
  if (err instanceof ServiceError) {
    return new NextResponse(err.message, { status: err.status });
  }
  console.error("[films/:id]", err);
  return new NextResponse("Internal server error", { status: 500 });
}

async function parseId(params: RouteParams["params"]) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id)) throw new ServiceError("Invalid id", 400);
  return id;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const actor = await getSessionActor();
  if (!actor) return new NextResponse("Unauthorized", { status: 401 });

  try {
    return NextResponse.json({ film: await getFilm(actor, await parseId(params)) });
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const actor = await getSessionActor();
  if (!actor) return new NextResponse("Unauthorized", { status: 401 });

  try {
    // deleteFilm answers 404 for a missing film and 403 when it is not yours,
    // instead of silently doing nothing.
    await deleteFilm(actor, await parseId(params));
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return fail(err);
  }
}

async function applyUpdate(req: NextRequest, params: RouteParams["params"]) {
  const actor = await getSessionActor();
  if (!actor) return new NextResponse("Unauthorized", { status: 401 });

  try {
    const id = await parseId(params);
    const json = await req.json();

    const patch: Record<string, unknown> = {};
    for (const key of [
      "title",
      "description",
      "date",
      "releaseDate",
      "startTime",
      "endTime",
      "formats",
      "allowMultiVote",
    ]) {
      if (Object.prototype.hasOwnProperty.call(json, key)) patch[key] = json[key];
    }

    // The browser sends back the signed poster URL it was given; strip the
    // signature so only the permanent URL is stored. Importing a poster from an
    // arbitrary URL is an MCP-only feature - from the web UI a poster always
    // comes from /api/upload, so anything else is refused here rather than
    // downloaded.
    if (Object.prototype.hasOwnProperty.call(json, "posterUrl")) {
      let posterUrl = json.posterUrl;
      if (typeof posterUrl === "string" && posterUrl.includes("?")) {
        posterUrl = posterUrl.split("?")[0];
      }
      if (posterUrl && !isOwnStorageUrl(String(posterUrl))) {
        throw new ServiceError("Upload the poster file instead of linking to it", 400);
      }
      patch.posterUrl = posterUrl;
    }

    const film = await updateFilm(actor, id, patch);
    return NextResponse.json({ film });
  } catch (err) {
    return fail(err);
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  return applyUpdate(req, params);
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  return applyUpdate(req, params);
}
