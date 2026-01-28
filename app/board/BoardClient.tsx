"use client";

import { useState } from "react";

type Attendee = {
  id: number;
  name: string | null;
  email: string;
  image: string | null;
};

type Film = {
  id: number;
  title: string;
  description: string | null;
  date: string | null;
  releaseDate: string | null;
  startTime: string | null;
  endTime: string | null;
  posterUrl: string | null;
  formats: string | null;
  attendees: Attendee[];
  attendeeCount: number;
  isAttending: boolean;
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

  async function loadMore() {
    if (!hasMore || loadingMore) return;

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

  async function toggleAttending(filmId: number, currentlyAttending: boolean) {
    const method = currentlyAttending ? "DELETE" : "POST";
    const res = await fetch(`/api/films/${filmId}/attend`, { method });

    if (res.ok) {
      setFilms((prev) =>
        prev.map((film) => {
          if (film.id === filmId) {
            return {
              ...film,
              isAttending: !currentlyAttending,
              attendeeCount: currentlyAttending
                ? film.attendeeCount - 1
                : film.attendeeCount + 1,
            };
          }
          return film;
        })
      );
    }
  }

  // Group films by date. Use 'TBA' for films with no date.
  const grouped = films.reduce<Record<string, Film[]>>((acc, film) => {
    // Use Screening Date > Release Date > TBA
    const key = film.date || film.releaseDate || "TBA";
    (acc[key] = acc[key] || []).push(film);
    return acc;
  }, {});

  const dates = Object.keys(grouped).sort((a, b) => {
    if (a === "TBA") return 1; // TBA at the end
    if (b === "TBA") return -1;
    return a.localeCompare(b);
  });

  return (
    <div className="mx-auto max-w-3xl space-y-12 pb-24">
      {dates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 py-20 text-center">
          <div className="mb-4 rounded-full bg-zinc-900 p-4 ring-1 ring-zinc-800">
            <svg
              className="h-8 w-8 text-zinc-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
              />
            </svg>
          </div>
          <p className="text-lg font-medium text-zinc-200">The board is empty</p>
          <p className="text-sm text-zinc-500">
            Add a film to kickstart the schedule
          </p>
        </div>
      ) : (
        dates.map((date) => {
          const isTBA = date === "TBA";
          const dateObj = isTBA ? null : new Date(date);
          const isToday =
            !isTBA && new Date().toISOString().split("T")[0] === date;

          return (
            <section key={date} className="relative">
              {/* Date Header */}
              <div className="sticky top-4 z-20 mb-6 flex items-center gap-4">
                <div
                  className={`flex h-12 w-12 flex-none flex-col items-center justify-center rounded-xl border shadow-sm backdrop-blur-md ${isToday
                    ? "border-blue-500/50 bg-blue-500/10 text-blue-400"
                    : "border-zinc-800 bg-zinc-950/80 text-zinc-400"
                    }`}
                >
                  <span className="text-xs font-bold uppercase">
                    {dateObj ? dateObj.toLocaleDateString("en-US", { month: "short" }) : "—"}
                  </span>
                  <span className="text-lg font-bold leading-none">
                    {dateObj ? dateObj.getDate() : "?"}
                  </span>
                </div>
                <div className="flex flex-col">
                  <h2 className="text-lg font-semibold text-zinc-100">
                    {dateObj ? dateObj.toLocaleDateString("en-US", { weekday: "long" }) : "To Be Announced"}
                  </h2>
                  <span className="text-sm text-zinc-500">
                    {dateObj ? dateObj.getFullYear() : "Date pending"}
                  </span>
                </div>
              </div>

              {/* Connector Line */}
              <div className="absolute left-6 top-16 bottom-0 w-px bg-gradient-to-b from-zinc-800 to-transparent -z-10" />

              <div className="space-y-6 pl-0 md:pl-16">
                {grouped[date].map((film) => (
                  <div
                    key={film.id}
                    className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40 p-1 transition-all hover:border-zinc-700 hover:bg-zinc-900/60"
                  >
                    <div className="flex gap-4 p-3 sm:gap-6">
                      {/* Poster */}
                      <div className="relative aspect-[2/3] w-24 flex-none overflow-hidden rounded-lg bg-zinc-800 shadow-lg sm:w-32">
                        {film.posterUrl ? (
                          <img
                            src={film.posterUrl}
                            alt={film.title}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-zinc-700">
                            <svg
                              className="h-8 w-8"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                              />
                            </svg>
                          </div>
                        )}
                        {/* Status badge */}
                        {film.isAttending && (
                          <div className="absolute right-2 top-2 rounded-full bg-blue-600 p-1 text-white shadow-lg shadow-blue-900/20">
                            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex min-w-0 flex-1 flex-col justify-between py-1">
                        <div className="space-y-2">
                          <div>
                            <h3 className="truncate text-lg font-bold text-zinc-100 group-hover:text-white">
                              {film.title}
                            </h3>
                            <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-400">
                              {(film.startTime || film.endTime) && (
                                <span className="flex items-center gap-1.5 rounded-md bg-zinc-800/50 px-2 py-0.5 text-xs font-medium text-zinc-300">
                                  <svg
                                    className="h-3.5 w-3.5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                  </svg>
                                  {film.startTime}
                                  {film.endTime && ` – ${film.endTime}`}
                                </span>
                              )}

                              {/* Format Tags */}
                              {film.formats && film.formats.split(",").map(fmt => (
                                <span key={fmt} className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                                  {fmt}
                                </span>
                              ))}

                              {/* Screening vs Release Badge */}
                              <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${film.date
                                  ? "border-blue-500/30 bg-blue-500/10 text-blue-400"
                                  : "border-zinc-700 bg-zinc-800 text-zinc-400"
                                }`}>
                                {film.date ? "Screening" : "Release"}
                              </span>
                            </div>
                          </div>

                          {film.description && (
                            <p className="line-clamp-2 text-sm text-zinc-400">
                              {film.description}
                            </p>
                          )}
                        </div>

                        {/* Footer / Actions */}
                        <div className="mt-4 flex flex-col items-start justify-between gap-4 border-t border-white/5 pt-4 sm:flex-row sm:items-center">
                          {/* Attendees Stack */}
                          {film.attendees.length > 0 ? (
                            <div className="flex -space-x-2 overflow-hidden">
                              {film.attendees.slice(0, 5).map((attendee) => (
                                <div
                                  key={attendee.id}
                                  className="relative inline-block h-8 w-8 rounded-full ring-2 ring-zinc-950"
                                  title={attendee.name || attendee.email}
                                >
                                  {attendee.image ? (
                                    <img
                                      src={attendee.image}
                                      alt=""
                                      className="h-full w-full rounded-full object-cover"
                                      referrerPolicy="no-referrer"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center rounded-full bg-zinc-700 text-[10px] font-bold text-white">
                                      {attendee.name?.[0] || attendee.email[0]}
                                    </div>
                                  )}
                                </div>
                              ))}
                              {film.attendees.length > 5 && (
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 ring-2 ring-zinc-950">
                                  <span className="text-[10px] font-medium text-white">
                                    +{film.attendees.length - 5}
                                  </span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-zinc-500 italic">No one attending yet</span>
                          )}

                          <button
                            onClick={() => toggleAttending(film.id, film.isAttending)}
                            className={`group/btn relative flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${film.isAttending
                              ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white"
                              : "bg-white text-zinc-950 shadow-sm hover:bg-zinc-200"
                              }`}
                          >
                            <span>{film.isAttending ? "I'm going" : "Join Screening"}</span>
                            {film.isAttending && (
                              <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })
      )}

      {hasMore && (
        <div className="flex justify-center pt-8">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/50 px-6 py-3 text-sm font-medium text-zinc-300 backdrop-blur-sm transition-colors hover:bg-zinc-800 hover:text-white disabled:opacity-50"
          >
            {loadingMore && (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {loadingMore ? "Loading more films..." : "Show earlier films"}
          </button>
        </div>
      )}

      {!hasMore && films.length > 0 && (
        <div className="flex justify-center py-8">
          <span className="inline-flex items-center gap-2 rounded-full bg-zinc-900/50 px-4 py-2 text-xs text-zinc-500">
            You've reached the end of the timeline
          </span>
        </div>
      )}
    </div>
  );
}
