import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { films, attendees, users } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { signPosterUrl } from "@/lib/s3";

const filmSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  date: z.string().nullable().optional(),
  releaseDate: z.string().nullable().optional(),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  posterUrl: z.string().nullable().optional(),
  formats: z.string().nullable().optional(),
});

export async function GET() {
  const session = await auth();
  // @ts-expect-error added in auth callback
  const userId: number | undefined = session?.user?.id;
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Get all films with attendee information
  const allFilms = await db
    .select({
      id: films.id,
      title: films.title,
      description: films.description,
      date: films.date,
      releaseDate: films.releaseDate,
      startTime: films.startTime,
      endTime: films.endTime,
      posterUrl: films.posterUrl,
      createdBy: films.createdBy,
      createdAt: films.createdAt,
      attendeeCount: sql<number>`count(distinct ${attendees.userId})`,
      isAttending: sql<number>`sum(case when ${attendees.userId} = ${userId} then 1 else 0 end)`,
    })
    .from(films)
    .leftJoin(attendees, eq(films.id, attendees.filmId))
    .groupBy(films.id)
    .orderBy(films.date, films.startTime);

  // Get creator info and attendee details for each film
  const filmsWithDetails = await Promise.all(
    allFilms.map(async (film) => {
      const [creator] = await db
        .select({ name: users.name, email: users.email, image: users.image })
        .from(users)
        .where(eq(users.id, film.createdBy));

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

      const signedPosterUrl = await signPosterUrl(film.posterUrl);

      return {
        ...film,
        posterUrl: signedPosterUrl,
        isAttending: film.isAttending > 0,
        creator,
        attendees: filmAttendees,
      };
    })
  );

  return NextResponse.json({ films: filmsWithDetails });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  // @ts-expect-error added in auth callback
  const userId: number | undefined = session?.user?.id;
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const body = await req.json();
  const parsed = filmSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(parsed.error.format(), { status: 400 });
  }

  // Ensure user exists in db (handle stale sessions after db reset)
  const userExists = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!userExists[0]) {
    return new NextResponse("User not found", { status: 401 });
  }

  // Create film
  const [inserted] = await db
    .insert(films)
    .values({
      ...parsed.data,
      createdBy: userId,
    })
    .returning();

  // Add creator as first attendee
  await db.insert(attendees).values({
    filmId: inserted.id,
    userId,
  });

  return NextResponse.json({ film: inserted }, { status: 201 });
}

