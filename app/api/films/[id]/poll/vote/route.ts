import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { films, pollOptions, pollVotes } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getPollData } from "@/lib/poll";

type RouteParams = { params: Promise<{ id: string }> };

const bodySchema = z.object({ optionId: z.number().int().positive() });

async function loadFilmAndOption(filmId: number, optionId: number) {
  const [film] = await db.select().from(films).where(eq(films.id, filmId)).limit(1);
  if (!film) return { error: "Film not found" as const };
  const [option] = await db
    .select()
    .from(pollOptions)
    .where(and(eq(pollOptions.id, optionId), eq(pollOptions.filmId, filmId)))
    .limit(1);
  if (!option) return { error: "Option not found" as const };
  return { film, option };
}

// Add a vote (single-choice polls replace any previous vote).
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

  const result = await loadFilmAndOption(filmId, parsed.data.optionId);
  if ("error" in result) return new NextResponse(result.error, { status: 404 });
  const { film } = result;

  if (!film.allowMultiVote) {
    // Single-choice: clear this user's other votes for this film first.
    const filmOptions = await db
      .select({ id: pollOptions.id })
      .from(pollOptions)
      .where(eq(pollOptions.filmId, filmId));
    const ids = filmOptions.map((o) => o.id);
    if (ids.length > 0) {
      await db
        .delete(pollVotes)
        .where(and(inArray(pollVotes.optionId, ids), eq(pollVotes.userId, userId)));
    }
  }

  try {
    await db
      .insert(pollVotes)
      .values({ optionId: parsed.data.optionId, userId });
  } catch {
    // Unique constraint → already voted for this option; ignore.
  }

  const poll = await getPollData(filmId, film.allowMultiVote, userId);
  return NextResponse.json({ poll });
}

// Remove a vote.
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  // @ts-expect-error added in auth callback
  const userId: number | undefined = session?.user?.id;
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { id: idParam } = await params;
  const filmId = Number(idParam);
  if (Number.isNaN(filmId)) return new NextResponse("Invalid film ID", { status: 400 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return new NextResponse("Invalid body", { status: 400 });

  const result = await loadFilmAndOption(filmId, parsed.data.optionId);
  if ("error" in result) return new NextResponse(result.error, { status: 404 });
  const { film } = result;

  await db
    .delete(pollVotes)
    .where(and(eq(pollVotes.optionId, parsed.data.optionId), eq(pollVotes.userId, userId)));

  const poll = await getPollData(filmId, film.allowMultiVote, userId);
  return NextResponse.json({ poll });
}
