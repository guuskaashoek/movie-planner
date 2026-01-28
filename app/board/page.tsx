import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { films, boardSettings, attendees, users } from "@/lib/db/schema";
import { BoardClient } from "./BoardClient";
import { CalendarSubscription } from "./CalendarSubscription";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { signPosterUrl } from "@/lib/s3";

const PAGE_SIZE = 20;

export default async function BoardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  // @ts-expect-error id is added in auth callback
  const userId: number = session.user.id;

  if (!userId) {
    console.error("User ID not found in session");
    redirect("/");
  }

  // All films are on the board now
  const allFilms = await db
    .select()
    .from(films)
    .orderBy(films.date, films.startTime)
    .limit(PAGE_SIZE);

  // For each film, get attendee information
  const initialFilms = await Promise.all(
    allFilms.map(async (film) => {
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

      const isAttending = filmAttendees.some((a) => a.id === userId);
      const signedPosterUrl = await signPosterUrl(film.posterUrl);

      return {
        ...film,
        posterUrl: signedPosterUrl,
        attendees: filmAttendees,
        attendeeCount: filmAttendees.length,
        isAttending,
      };
    })
  );

  const totalFilms = await db.select({ count: films.id }).from(films);

  const hasMore = (totalFilms[0]?.count ?? 0) > initialFilms.length;

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
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Calendar Subscription Section */}
      <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
        <div className="space-y-4">
          <div>
            <h1 className="text-xl font-semibold text-zinc-50">
              Calendar Board
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Subscribe to sync films you're attending to your calendar
            </p>
          </div>

          <CalendarSubscription icsUrl={icsUrl} />
        </div>
      </section>

      <BoardClient
        initial={{
          films: initialFilms,
          hasMore,
        }}
      />
    </div>
  );
}

