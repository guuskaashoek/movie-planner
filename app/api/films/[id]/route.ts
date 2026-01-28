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
  const { title, date, releaseDate, startTime, endTime, posterUrl, formats } = json;

  // Only creator can update
  await db
    .update(films)
    .set({
      title,
      date,
      releaseDate,
      startTime: startTime || null,
      endTime: endTime || null,
      posterUrl,
      formats,
    })
    .where(and(eq(films.id, id), eq(films.createdBy, userId)));

  return new NextResponse(null, { status: 204 });
}

