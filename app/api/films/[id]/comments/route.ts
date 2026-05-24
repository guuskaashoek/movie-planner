import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { comments, films } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getComments } from "@/lib/comments";
import { publishLiveEvent } from "@/lib/live";

type RouteParams = { params: Promise<{ id: string }> };

const bodySchema = z.object({ body: z.string().trim().min(1).max(2000) });

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id: idParam } = await params;
  const filmId = Number(idParam);
  if (Number.isNaN(filmId)) return new NextResponse("Invalid film ID", { status: 400 });

  const list = await getComments(filmId);
  return NextResponse.json({ comments: list });
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  // @ts-expect-error added in auth callback
  const userId: number | undefined = session?.user?.id;
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { id: idParam } = await params;
  const filmId = Number(idParam);
  if (Number.isNaN(filmId)) return new NextResponse("Invalid film ID", { status: 400 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return new NextResponse("Invalid body", { status: 400 });

  const [film] = await db.select().from(films).where(eq(films.id, filmId)).limit(1);
  if (!film) return new NextResponse("Film not found", { status: 404 });

  await db.insert(comments).values({ filmId, userId, body: parsed.data.body });

  const list = await getComments(filmId);
  publishLiveEvent({ topic: "comment", filmId });
  return NextResponse.json({ comments: list }, { status: 201 });
}
