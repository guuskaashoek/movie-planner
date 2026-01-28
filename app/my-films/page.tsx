import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { MyFilmsClient } from "./MyFilmsClient";
import { db } from "@/lib/db/client";
import { films, attendees, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { signPosterUrl } from "@/lib/s3";

export default async function MyFilmsPage() {
  const session = await auth();

  if (session?.user) {
    console.log("MyFilms Page - Session User:", JSON.stringify(session.user, null, 2));
  }

  if (!session?.user) {
    redirect("/");
  }

  // @ts-expect-error id is added in auth callback
  const userId: number = session.user.id;

  if (!userId) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-4">
        <p className="text-zinc-400">Session error: User ID missing. Please sign out.</p>
        <form
          action={async () => {
            "use server";
            await signOut();
          }}
        >
          <button
            type="submit"
            className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black"
          >
            Sign out
          </button>
        </form>
      </div>
    );
  }

  // Fetch all films directly from database
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
      formats: films.formats,
      createdBy: films.createdBy,
      createdAt: films.createdAt,
    })
    .from(films)
    .orderBy(films.date, films.startTime);

  // For each film, get attendee information and creator info
  const filmsWithDetails = await Promise.all(
    allFilms.map(async (film) => {
      // Get creator info
      const [creator] = await db
        .select({
          name: users.name,
          email: users.email,
          image: users.image,
        })
        .from(users)
        .where(eq(users.id, film.createdBy));

      // Get all attendees
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
        creator,
        attendees: filmAttendees,
        attendeeCount: filmAttendees.length,
        isAttending,
      };
    })
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {session.user.image && (
            <img
              src={session.user.image}
              alt={session.user.name || session.user.email || "User"}
              className="h-10 w-10 rounded-full border border-zinc-700"
              referrerPolicy="no-referrer"
            />
          )}
          <div>
            <p className="text-xs text-zinc-400">Signed in as</p>
            <p className="text-sm font-medium text-zinc-100">
              {session.user.name ?? session.user.email}
            </p>
          </div>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut();
          }}
        >
          <button
            type="submit"
            className="rounded-md border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:border-zinc-600 hover:bg-zinc-900"
          >
            Sign out
          </button>
        </form>
      </div>
      <MyFilmsClient
        initial={{ films: filmsWithDetails, currentUserId: userId }}
      />
    </div>
  );
}
