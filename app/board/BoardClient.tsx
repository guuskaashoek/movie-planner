"use client";

import { useEffect, useState } from "react";

type Film = {
  id: number;
  title: string;
  description: string | null;
  date: string;
  startTime: string | null;
  endTime: string | null;
  posterUrl: string | null;
};

type ApiResponse = {
  films: Film[];
  hasMore: boolean;
};

export function BoardClient({ initial }: { initial: ApiResponse }) {
  const [films, setFilms] = useState<Film[]>(initial.films);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    function onScroll() {
      if (!hasMore || loadingMore) return;
      const nearBottom =
        window.innerHeight + window.scrollY >=
        document.body.offsetHeight - 400;
      if (nearBottom) {
        void loadMore();
      }
    }
    async function loadMore() {
      setLoadingMore(true);
      try {
        const res = await fetch(`/api/board?page=${page}`);
        if (!res.ok) return;
        const data = (await res.json()) as ApiResponse;
        setFilms((prev) => [...prev, ...data.films]);
        setHasMore(data.hasMore);
        setPage((p) => p + 1);
      } finally {
        setLoadingMore(false);
      }
    }
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [hasMore, loadingMore, page]);

  const grouped = films.reduce<Record<string, Film[]>>((acc, film) => {
    (acc[film.date] = acc[film.date] || []).push(film);
    return acc;
  }, {});

  const dates = Object.keys(grouped).sort();

  return (
    <div className="space-y-6">
      {dates.map((date) => (
        <section key={date} className="space-y-3">
          <div className="sticky top-0 z-10 -mx-4 border-b border-zinc-800 bg-black/90 px-4 py-2 backdrop-blur">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
              {date}
            </p>
          </div>
          <div className="space-y-3">
            {grouped[date].map((film) => (
              <div
                key={film.id}
                className="flex items-start gap-4 rounded-lg border border-zinc-800 bg-zinc-950 p-4"
              >
                {film.posterUrl && (
                  <img
                    src={film.posterUrl}
                    alt={film.title}
                    className="h-20 w-14 flex-none rounded-md object-cover"
                  />
                )}
                <div className="space-y-1">
                  <p className="text-sm font-medium text-zinc-100">
                    {film.title}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {film.startTime &&
                      `${film.startTime}${
                        film.endTime ? ` – ${film.endTime}` : ""
                      }`}
                  </p>
                  {film.description && (
                    <p className="text-xs text-zinc-400">
                      {film.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
      {loadingMore && (
        <p className="py-4 text-center text-xs text-zinc-500">Loading…</p>
      )}
      {!hasMore && films.length > 0 && (
        <p className="py-4 text-center text-xs text-zinc-500">
          End of board.
        </p>
      )}
      {films.length === 0 && (
        <p className="text-sm text-zinc-500">
          No films on the board yet. Send a film from your personal list.
        </p>
      )}
    </div>
  );
}

