import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { films, boardSettings, attendees, users, filmRatings, filmTickets } from "@/lib/db/schema";
import { BoardClient } from "./BoardClient";
import { CalendarSubscription } from "./CalendarSubscription";
import { eq, sql } from "drizzle-orm";
import { randomBytes } from "crypto";
import { signPosterUrl } from "@/lib/s3";
import { getPollData } from "@/lib/poll";

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

export default async function BoardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  // @ts-expect-error id is added in auth callback
  const userId: number = session.user.id;

  if (!userId) {
    console.error("User ID not found in session");
    // return redirect("/api/auth/signin"); // Avoid loop
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="mb-4 text-zinc-400">Session error: User ID missing.</p>
        <Link href="/api/auth/signout" className="rounded bg-white px-4 py-2 text-black text-sm">Sign Out</Link>
      </div>
    )
  }

  // All films are on the board now
  const allFilms = await db
    .select()
    .from(films)
    .orderBy(films.date, films.startTime);

  // Auto-generate invite tokens for films that don't have one
  for (const film of allFilms) {
    if (!film.inviteToken) {
      const token = randomBytes(16).toString("hex");
      await db.update(films).set({ inviteToken: token }).where(eq(films.id, film.id));
      film.inviteToken = token;
    }
  }

  const ticketCounts = await db
    .select({
      filmId: filmTickets.filmId,
      count: sql<number>`count(*)`,
    })
    .from(filmTickets)
    .groupBy(filmTickets.filmId);
  const admissionByFilm = new Map(ticketCounts.map((row) => [row.filmId, Number(row.count)]));

  // For each film, get attendee information
  const filmsWithAttendees = await Promise.all(
    allFilms.map(async (film) => {
      const goingUsers = await db
        .select({ id: users.id, name: users.name, email: users.email, image: users.image })
        .from(attendees)
        .innerJoin(users, eq(attendees.userId, users.id))
        .where(sql`${attendees.filmId} = ${film.id} AND ${attendees.type} = 'going'`);

      const interestedUsers = await db
        .select({ id: users.id, name: users.name, email: users.email, image: users.image })
        .from(attendees)
        .innerJoin(users, eq(attendees.userId, users.id))
        .where(sql`${attendees.filmId} = ${film.id} AND ${attendees.type} = 'interested'`);

      const isInterested = interestedUsers.some((a) => a.id === userId);
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
        allRatings.find((rating) => rating.userId === userId)?.rating ?? null;

      const poll = await getPollData(film.id, film.allowMultiVote, userId);

      // For poll films the schedule is driven by the winning option; surface
      // that as the effective date/time so the board groups & sorts correctly.
      let date = film.date;
      let startTime = film.startTime;
      let endTime = film.endTime;
      let isGoing = goingUsers.some((a) => a.id === userId);
      if (poll) {
        const winner = poll.options.find((o) => o.isWinning) ?? null;
        date = winner?.date ?? null;
        startTime = winner?.startTime ?? null;
        endTime = winner?.endTime ?? null;
        isGoing = winner ? winner.votedByMe : false;
      }

      return {
        ...film,
        date,
        startTime,
        endTime,
        posterUrl: signedPosterUrl,
        backdropUrl: await signPosterUrl(film.backdropUrl),
        goingUsers,
        interestedUsers,
        isGoing,
        isInterested,
        admissionTicketCount: admissionByFilm.get(film.id) ?? 0,
        poll,
        canRate: isGoing && hasFilmEnded(date, endTime),
        myRating,
        ratingCount,
        averageRating,
      };
    })
  );

  // Get or create user's board settings for calendar feed
  let [userSettings] = await db
    .select()
    .from(boardSettings)
    .where(eq(boardSettings.userId, userId));

  if (!userSettings) {
    // Create board settings for user
    const icsShareId = randomBytes(16).toString("hex");
    [userSettings] = await db
      .insert(boardSettings)
      .values({
        userId,
        name: `${session.user.name || session.user.email}'s Calendar`,
        icsShareId,
      })
      .returning();
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const icsUrl = `${baseUrl.replace(/\/$/, "")}/api/calendar/feed.ics?userId=${userSettings.icsShareId}`;

  return (
    <div>
      <BoardClient
        initial={{
          films: filmsWithAttendees,
          now: new Date().toISOString(),
          hasMore: false,
          currentUserEmail: session.user.email,
          baseUrl,
        }}
      />
      <details className="mx-auto max-w-3xl px-[4vw] pb-10">
        <summary className="cursor-pointer py-3 text-sm font-medium text-zinc-400">Sync with your calendar</summary>
        <div className="mt-3 space-y-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <p className="text-sm text-zinc-500">Subscribe to the films you’re attending.</p>
          <CalendarSubscription icsUrl={icsUrl} />
        </div>
      </details>
    </div>
  );
}
