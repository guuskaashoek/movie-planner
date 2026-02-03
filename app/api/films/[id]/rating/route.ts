import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { attendees, filmRatings, films } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

type RouteParams = {
  params: Promise<{ id: string }>;
};

const ratingSchema = z.object({
  rating: z.number().int().min(1).max(5),
});

function hasFilmEnded(date: string | null, endTime: string | null) {
  if (!date) return false;

  const now = new Date();
  const today = now.toISOString().split("T")[0];

  if (date < today) return true;
  if (date > today) return false;

  if (!endTime) return false;

  const [hourString, minuteString] = endTime.split(":");
  const hour = Number(hourString);
  const minute = Number(minuteString);

  if (Number.isNaN(hour) || Number.isNaN(minute)) return false;

  const endAt = new Date(now);
  endAt.setHours(hour, minute, 0, 0);

  return now >= endAt;
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  // @ts-expect-error added in auth callback
  const userId: number | undefined = session?.user?.id;
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id: idParam } = await params;
  const filmId = Number(idParam);
  if (Number.isNaN(filmId)) {
    return new NextResponse("Invalid film ID", { status: 400 });
  }

  const json = await req.json();
  const parsed = ratingSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(parsed.error.format(), { status: 400 });
  }

  const [film] = await db
    .select({ id: films.id, date: films.date, endTime: films.endTime })
    .from(films)
    .where(eq(films.id, filmId))
    .limit(1);

  if (!film) {
    return new NextResponse("Film not found", { status: 404 });
  }

  const [attendance] = await db
    .select({ id: attendees.id })
    .from(attendees)
    .where(and(eq(attendees.filmId, filmId), eq(attendees.userId, userId)))
    .limit(1);

  if (!attendance) {
    return new NextResponse("Only attendees can rate this film", { status: 403 });
  }

  if (!hasFilmEnded(film.date, film.endTime)) {
    return new NextResponse("You can rate after the screening has ended", {
      status: 400,
    });
  }

  await db
    .insert(filmRatings)
    .values({
      filmId,
      userId,
      rating: parsed.data.rating,
    })
    .onConflictDoUpdate({
      target: [filmRatings.filmId, filmRatings.userId],
      set: { rating: parsed.data.rating },
    });

  const [stats] = await db
    .select({
      averageRating: sql<number | null>`avg(${filmRatings.rating})`,
      ratingCount: sql<number>`count(*)`,
    })
    .from(filmRatings)
    .where(eq(filmRatings.filmId, filmId));

  return NextResponse.json({
    filmId,
    myRating: parsed.data.rating,
    averageRating: stats?.averageRating ?? null,
    ratingCount: stats?.ratingCount ?? 0,
  });
}
