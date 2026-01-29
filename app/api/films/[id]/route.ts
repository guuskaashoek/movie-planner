import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { films } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

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
    .where(and(eq(films.id, id), eq(films.createdBy, userId)));

  return new NextResponse(null, { status: 204 });
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
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

  const json = await req.json();
  // Dynamically build the update object to only update fields present in the request.
  // This supports partial updates and prevents overwriting existing data with null/undefined
  // if it wasn't sent.
  const updateData: any = {};
  if (json.title !== undefined) updateData.title = json.title;
  if (json.date !== undefined) updateData.date = json.date;
  if (json.releaseDate !== undefined) updateData.releaseDate = json.releaseDate;
  if (json.startTime !== undefined) updateData.startTime = json.startTime || null;
  if (json.endTime !== undefined) updateData.endTime = json.endTime || null;
  if (json.formats !== undefined) updateData.formats = json.formats;

  if (json.posterUrl !== undefined) {
    let cleanPosterUrl = json.posterUrl;
    // If we receive a signed Wasabi URL, strip the signature and query params
    // to store only the permanent URL/Path.
    if (
      typeof cleanPosterUrl === "string" &&
      cleanPosterUrl.includes("wasabisys.com") &&
      cleanPosterUrl.includes("?")
    ) {
      cleanPosterUrl = cleanPosterUrl.split("?")[0];
    }
    updateData.posterUrl = cleanPosterUrl;
  }

  // If no fields to update, return early
  if (Object.keys(updateData).length === 0) {
    return new NextResponse("No changes provided", { status: 400 });
  }

  // Only creator can update
  await db
    .update(films)
    .set(updateData)
    .where(and(eq(films.id, id), eq(films.createdBy, userId)));

  return new NextResponse(null, { status: 204 });
}

