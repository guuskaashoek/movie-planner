import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { films, attendees, users, filmRatings } from "@/lib/db/schema";
import { eq, gte, or, isNull, sql } from "drizzle-orm";
import { signPosterUrl } from "@/lib/s3";

const PAGE_SIZE = 20;

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

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // @ts-expect-error id is added in auth callback
  const currentUserId: number = session.user.id;

  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get("page") ?? "0");
  const safePage = Number.isNaN(page) || page < 0 ? 0 : page;

  // Filter: Upcoming films (date >= today) or TBA (date is null)
  const today = new Date().toISOString().split("T")[0];
  const whereClause = or(isNull(films.date), gte(films.date, today));

  // Get all films
  const pageFilms = await db
    .select()
    .from(films)
    .where(whereClause)
    .orderBy(films.date, films.startTime)
    .limit(PAGE_SIZE)
    .offset(safePage * PAGE_SIZE);

  // For each film, get attendee information
  const filmsWithAttendees = await Promise.all(
    pageFilms.map(async (film) => {
      const filmAttendees = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          image: users.image,
        })
        .from(attendees)
        .innerJoin(users, eq(attendees.userId, users.id))
        .where(eq(attendees.filmId, film.id));

      const isAttending = filmAttendees.some((a) => a.id === currentUserId);
      const signedPosterUrl = await signPosterUrl(film.posterUrl);
      const allRatings = await db
        .select({ rating: filmRatings.rating, userId: filmRatings.userId })
        .from(filmRatings)
        .where(eq(filmRatings.filmId, film.id));

      const ratingCount = allRatings.length;
      const averageRating =
        ratingCount > 0
          ? allRatings.reduce((sum, r) => sum + r.rating, 0) / ratingCount
          : null;
      const myRating =
        allRatings.find((rating) => rating.userId === currentUserId)?.rating ?? null;

      return {
        ...film,
        posterUrl: signedPosterUrl,
        attendees: filmAttendees,
        attendeeCount: filmAttendees.length,
        isAttending,
        canRate: isAttending && hasFilmEnded(film.date, film.endTime),
        myRating,
        ratingCount,
        averageRating,
      };
    })
  );

  const [totalCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(films)
    .where(whereClause);

  const hasMore = (totalCount?.count ?? 0) > (safePage + 1) * PAGE_SIZE;

  return NextResponse.json({
    films: filmsWithAttendees,
    hasMore,
  });
}
