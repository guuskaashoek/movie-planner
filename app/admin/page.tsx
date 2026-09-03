import { redirect } from "next/navigation";
import { getSessionActor } from "@/lib/authz";
import { getStats, listFilms, listUsers } from "@/lib/films";
import { AdminClient } from "./AdminClient";

export const metadata = { title: "Admin · Film Calendar" };

export default async function AdminPage() {
  const actor = await getSessionActor();
  if (!actor) redirect("/");
  if (!actor.isAdmin) redirect("/my-films");

  const [stats, users, films] = await Promise.all([
    getStats(actor),
    listUsers(actor),
    listFilms(actor, { scope: "all", limit: 100 }),
  ]);

  return (
    <AdminClient
      currentUserId={actor.userId}
      stats={stats}
      users={users}
      films={films.films.map((f) => ({
        id: f.id,
        title: f.title,
        date: f.date,
        startTime: f.startTime,
        releaseDate: f.releaseDate,
        ticketsOnSaleDate: f.ticketsOnSaleDate,
        ticketsOnSaleTime: f.ticketsOnSaleTime,
        posterUrl: f.posterUrl,
        createdBy: f.createdBy,
        ownerName: f.creator?.name ?? f.creator?.email ?? "unknown",
        attendeeCount: f.attendeeCount,
        ratingCount: f.ratingCount,
        averageRating: f.averageRating,
        hasPoll: Boolean(f.poll),
      }))}
      total={films.total}
    />
  );
}
