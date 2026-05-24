import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { films, attendees, users, filmRatings } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { signPosterUrl } from "@/lib/s3";
import { getPollData } from "@/lib/poll";
import { getComments } from "@/lib/comments";
import { FilmDetailClient } from "./FilmDetailClient";

function hasFilmEnded(date: string | null, endTime: string | null) {
  if (!date) return false;
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  if (date < today) return true;
  if (date > today) return false;
  if (!endTime) return false;
  const [h, m] = endTime.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return false;
  const endAt = new Date(now);
  endAt.setHours(h, m, 0, 0);
  return now >= endAt;
}

export default async function FilmDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/");
  // @ts-expect-error id is added in auth callback
  const userId: number = session.user.id;
  if (!userId) redirect("/");

  const { id: idParam } = await params;
  const filmId = Number(idParam);
  if (Number.isNaN(filmId)) notFound();

  const [film] = await db.select().from(films).where(eq(films.id, filmId)).limit(1);
  if (!film) notFound();

  const [creator] = await db
    .select({ name: users.name, email: users.email, image: users.image })
    .from(users)
    .where(eq(users.id, film.createdBy));

  const goingUsers = await db
    .select({ id: users.id, name: users.name, email: users.email, image: users.image })
    .from(attendees)
    .innerJoin(users, eq(attendees.userId, users.id))
    .where(sql`${attendees.filmId} = ${filmId} AND ${attendees.type} = 'going'`);

  const interestedUsers = await db
    .select({ id: users.id, name: users.name, email: users.email, image: users.image })
    .from(attendees)
    .innerJoin(users, eq(attendees.userId, users.id))
    .where(sql`${attendees.filmId} = ${filmId} AND ${attendees.type} = 'interested'`);

  const allRatings = await db
    .select({ rating: filmRatings.rating, userId: filmRatings.userId })
    .from(filmRatings)
    .where(eq(filmRatings.filmId, filmId));
  const ratingCount = allRatings.length;
  const averageRating =
    ratingCount > 0 ? allRatings.reduce((s, r) => s + r.rating, 0) / ratingCount : null;
  const myRating = allRatings.find((r) => r.userId === userId)?.rating ?? null;

  const poll = await getPollData(filmId, film.allowMultiVote, userId);
  const comments = await getComments(filmId);
  const posterUrl = await signPosterUrl(film.posterUrl);

  // Poll films are scheduled by their winning option.
  let date = film.date;
  let startTime = film.startTime;
  let endTime = film.endTime;
  let isGoing = goingUsers.some((u) => u.id === userId);
  if (poll) {
    const winner = poll.options.find((o) => o.isWinning) ?? null;
    date = winner?.date ?? null;
    startTime = winner?.startTime ?? null;
    endTime = winner?.endTime ?? null;
    isGoing = winner ? winner.votedByMe : false;
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  return (
    <div className="mx-auto max-w-5xl">
      <FilmDetailClient
        initial={{
          film: {
            id: film.id,
            title: film.title,
            description: film.description,
            formats: film.formats,
            date,
            startTime,
            endTime,
            releaseDate: film.releaseDate,
            posterUrl,
            inviteToken: film.inviteToken,
            creator: creator ?? null,
          },
          poll,
          goingUsers,
          interestedUsers,
          isGoing,
          isInterested: interestedUsers.some((u) => u.id === userId),
          canRate: isGoing && hasFilmEnded(date, endTime),
          myRating,
          averageRating,
          ratingCount,
          comments,
          currentUserId: userId,
          isCreator: film.createdBy === userId,
          baseUrl: baseUrl.replace(/\/$/, ""),
        }}
      />
    </div>
  );
}
