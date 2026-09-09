import { notFound } from "next/navigation";
import Link from "next/link";
import { BoardClient } from "@/app/board/BoardClient";
import { previewFilms } from "./fixtures";

export const dynamic = "force-dynamic";

export default async function PreviewPage({ searchParams }: { searchParams: Promise<{ film?: string }> }) {
  // This preview contains only fixtures; never expose a production auth bypass.
  if (process.env.NODE_ENV !== "development") notFound();
  const now = new Date();
  const films = previewFilms(now);
  const { film: selected } = await searchParams;
  const film = selected ? films.find((item) => item.id === Number(selected)) : null;
  if (selected && !film) notFound();

  if (film) {
    return (
      <div className="page-frame-wide">
        <Link className="inline-flex min-h-11 items-center text-sm text-zinc-400" href="/preview">
          ← Back to the board
        </Link>
        <div className="mt-6 grid gap-6 sm:grid-cols-[180px_1fr]">
          {film.posterUrl && <img src={film.posterUrl} alt={film.title} className="w-40 rounded-xl sm:w-full" />}
          <div>
            <h1 className="text-4xl font-bold tracking-tight">{film.title}</h1>
            <p className="mt-4 text-sm leading-relaxed text-zinc-400">{film.description}</p>
            <p className="mt-5 text-sm">
              {film.date} · {film.startTime} · {film.formats}
            </p>
            <p className="mt-2 text-sm text-zinc-500">{film.goingUsers.length} people going</p>
            {film.ticketsOnSaleDate && (
              <p className="mt-5 text-sm text-lime-200">
                Sample ticket sale: {film.ticketsOnSaleDate} · {film.ticketsOnSaleTime}
              </p>
            )}
            {(film.admissionTicketCount ?? 0) > 0 && (
              <p className="mt-3 text-sm text-lime-200">
                We have tickets for this screening.{" "}
                <Link href="/preview/tickets" className="underline underline-offset-4">
                  Open tickets
                </Link>
              </p>
            )}
          </div>
        </div>
        <p className="mt-10 text-[11px] text-zinc-600">
          Local preview · sample planning. Artwork belongs to its respective owners.
        </p>
      </div>
    );
  }

  return <BoardClient initial={{ films, now: now.toISOString() }} preview />;
}
