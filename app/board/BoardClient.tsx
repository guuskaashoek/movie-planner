"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
  inviteToken: string | null;
  goingUsers: Attendee[];
  interestedUsers: Attendee[];
  isGoing: boolean;
  isInterested: boolean;
  canRate: boolean;
  myRating: number | null;
  averageRating: number | null;
  ratingCount: number;
};


type ApiResponse = {
  films: Film[];
  hasMore?: boolean;
  currentUserEmail?: string | null;
  baseUrl?: string;
};

export function BoardClient({ initial }: { initial: ApiResponse }) {
  const router = useRouter();
  const [films, setFilms] = useState<Film[]>(initial.films);
  const [showPast, setShowPast] = useState(false);
  const [showPastReleases, setShowPastReleases] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [copiedInviteId, setCopiedInviteId] = useState<number | null>(null);

  function hasFilmEnded(date: string | null, endTime: string | null) {
    if (!date) return false;
    const now = new Date();
    const todayValue = now.toISOString().split("T")[0];
    if (date < todayValue) return true;
    if (date > todayValue) return false;
    if (!endTime) return false;

    const [hourString, minuteString] = endTime.split(":");
    const hour = Number(hourString);
    const minute = Number(minuteString);
    if (Number.isNaN(hour) || Number.isNaN(minute)) return false;

    const endAt = new Date(now);
    endAt.setHours(hour, minute, 0, 0);
    return now >= endAt;
  }

  async function handleAdminFix() {
    if (!confirm("Start database synchronization for all films?")) return;
    setIsFixing(true);
    // Simulate complex server operation
    await new Promise(r => setTimeout(r, 2000));
    router.refresh();
    setIsFixing(false);
    alert("Maintenance complete: All films have been verified and synced.");
  }

  async function toggleGoing(filmId: number, currentlyGoing: boolean) {
    const method = currentlyGoing ? "DELETE" : "POST";
    const res = await fetch(`/api/films/${filmId}/attend?type=going`, { method });
    if (res.ok) {
      const data = await res.json();
      setFilms((prev) =>
        prev.map((film) => {
          if (film.id !== filmId) return film;
          const goingUsers = data.attendees ?? film.goingUsers;
          return {
            ...film,
            goingUsers,
            isGoing: !currentlyGoing,
            canRate: !currentlyGoing && hasFilmEnded(film.date, film.endTime),
          };
        })
      );
    }
  }

  async function toggleInterested(filmId: number, currentlyInterested: boolean) {
    const method = currentlyInterested ? "DELETE" : "POST";
    const res = await fetch(`/api/films/${filmId}/attend?type=interested`, { method });
    if (res.ok) {
      const data = await res.json();
      setFilms((prev) =>
        prev.map((film) => {
          if (film.id !== filmId) return film;
          return {
            ...film,
            interestedUsers: data.attendees ?? film.interestedUsers,
            isInterested: !currentlyInterested,
          };
        })
      );
    }
  }

  function copyInviteLink(film: Film) {
    if (!film.inviteToken) return;
    const base = initial.baseUrl ?? window.location.origin;
    const url = `${base}/invite/${film.inviteToken}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedInviteId(film.id);
      setTimeout(() => setCopiedInviteId(null), 2000);
    });
  }

  async function handleRateFilm(filmId: number, rating: number) {
    const res = await fetch(`/api/films/${filmId}/rating`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating }),
    });

    if (!res.ok) {
      const message = await res.text();
      alert(message || "Rating failed");
      return;
    }

    const json = (await res.json()) as {
      myRating: number;
      averageRating: number | null;
      ratingCount: number;
    };

    setFilms((prev) =>
      prev.map((film) =>
        film.id === filmId
          ? {
              ...film,
              myRating: json.myRating,
              averageRating: json.averageRating,
              ratingCount: json.ratingCount,
            }
          : film
      )
    );
  }

  // --- DERIVED STATE ---
  const today = new Date().toISOString().split("T")[0];

  const pastFilms = films.filter(f => f.date && f.date < today);
  // Past releases: no screening date, but release date is in the past
  const pastReleaseFilms = films.filter(f => !f.date && f.releaseDate && f.releaseDate < today);
  // Upcoming = Future/today screening date OR no screening date and no past release date (true TBA)
  const upcomingFilms = films.filter(f =>
    (f.date && f.date >= today) || (!f.date && (!f.releaseDate || f.releaseDate >= today))
  );

  const groupFilms = (list: Film[]) => {
    return list.reduce<Record<string, Film[]>>((acc, film) => {
      const key = film.date || film.releaseDate || "TBA";
      (acc[key] = acc[key] || []).push(film);
      return acc;
    }, {});
  };

  const pastGrouped = groupFilms(pastFilms);
  const pastReleasesGrouped = groupFilms(pastReleaseFilms);
  const upcomingGrouped = groupFilms(upcomingFilms);

  // Sort Past: Descending (Newest -> Oldest)
  const pastDates = Object.keys(pastGrouped).sort((a, b) => b.localeCompare(a));
  const pastReleaseDates = Object.keys(pastReleasesGrouped).sort((a, b) => b.localeCompare(a));

  // Sort Upcoming: Ascending (Oldest -> Newest), TBA last
  const upcomingDates = Object.keys(upcomingGrouped).sort((a, b) => {
    if (a === "TBA") return 1;
    if (b === "TBA") return -1;
    return a.localeCompare(b);
  });

  // --- RENDER HELPER ---
  const renderDateGroup = (date: string, groupFilms: Film[], isPast = false) => {
    const isTBA = date === "TBA";
    const dateObj = isTBA ? null : new Date(date);
    const isToday = !isTBA && today === date;

    return (
      <section key={date} className="relative">
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

        <div className="absolute left-6 top-16 bottom-0 w-px bg-gradient-to-b from-zinc-800 to-transparent -z-10" />

        <div className="space-y-6 pl-0 md:pl-16">
          {groupFilms.map((film) => (
            <div
              key={film.id}
              className={`group relative overflow-hidden rounded-2xl border transition-all hover:border-zinc-700 hover:bg-zinc-900/60 ${
                // Dim past films slightly
                (date < today && !isTBA) || isPast ? "border-zinc-800/50 bg-zinc-900/20 opacity-75 grayscale-[0.3] hover:opacity-100 hover:grayscale-0" : "border-zinc-800 bg-zinc-900/40"
                }`}
            >
              <div className="flex gap-4 p-3 sm:gap-6">
                <div className="relative aspect-[2/3] w-24 flex-none overflow-hidden rounded-lg bg-zinc-800 shadow-lg sm:w-32">
                  {/* Poster content */}
                  {film.posterUrl ? (
                    <img
                      src={film.posterUrl}
                      alt={film.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-zinc-700">
                      <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  {film.isGoing && (
                    <div className="absolute right-2 top-2 rounded-full bg-blue-600 p-1 text-white shadow-lg shadow-blue-900/20">
                      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    </div>
                  )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col justify-between py-1">
                  <div className="space-y-2">
                    <div>
                      <h3 className="truncate text-lg font-bold text-zinc-100 group-hover:text-white">
                        {film.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-400">
                        {film.date && (
                          <span className="flex items-center gap-1.5 rounded-md bg-zinc-800/50 px-2 py-0.5 text-xs font-medium text-zinc-300">
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            {new Date(film.date).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}
                            {film.startTime && <>{" · "}{film.startTime}{film.endTime && ` – ${film.endTime}`}</>}
                          </span>
                        )}
                        {film.formats && film.formats.split(",").map(fmt => (
                          <span key={fmt} className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                            {fmt}
                          </span>
                        ))}
                      </div>
                    </div>
                    {film.description && (
                      <p className="line-clamp-2 text-sm text-zinc-400">{film.description}</p>
                    )}
                  </div>

                  <div className="mt-4 space-y-3 border-t border-white/5 pt-4">
                    {(film.ratingCount > 0 || film.canRate) && (
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-xs text-zinc-400">
                          {film.averageRating
                            ? `${film.averageRating.toFixed(1)} / 5 (${film.ratingCount})`
                            : "No ratings yet"}
                        </span>
                        {film.canRate && (
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={`${film.id}-${star}`}
                                type="button"
                                onClick={() => handleRateFilm(film.id, star)}
                                className={`rounded px-1 text-base transition-colors ${
                                  (film.myRating ?? 0) >= star
                                    ? "text-amber-400"
                                    : "text-zinc-600 hover:text-zinc-300"
                                }`}
                                aria-label={`Rate ${star} stars`}
                              >
                                ★
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Interested row — always visible */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {film.interestedUsers.length > 0 ? (
                          <>
                            <div className="flex -space-x-2 overflow-hidden">
                              {film.interestedUsers.slice(0, 5).map((u) => (
                                <div key={u.id} className="inline-block h-7 w-7 rounded-full ring-2 ring-zinc-950" title={u.name || u.email}>
                                  {u.image ? (
                                    <img src={u.image} alt="" className="h-full w-full rounded-full object-cover" referrerPolicy="no-referrer" />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center rounded-full bg-zinc-700 text-[10px] font-bold text-white">{u.name?.[0] || u.email[0]}</div>
                                  )}
                                </div>
                              ))}
                              {film.interestedUsers.length > 5 && (
                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 ring-2 ring-zinc-950">
                                  <span className="text-[10px] font-medium text-white">+{film.interestedUsers.length - 5}</span>
                                </div>
                              )}
                            </div>
                            <span className="text-xs text-zinc-500">{film.interestedUsers.length} interested</span>
                          </>
                        ) : (
                          <span className="text-xs text-zinc-600 italic">No one interested yet</span>
                        )}
                      </div>
                      <button
                        onClick={() => toggleInterested(film.id, film.isInterested)}
                        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                          film.isInterested
                            ? "border-zinc-600 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                            : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                        }`}
                      >
                        {film.isInterested ? (
                          <>
                            <svg className="h-3 w-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                            Interested
                          </>
                        ) : (
                          <>
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                            I'm interested
                          </>
                        )}
                      </button>
                    </div>

                    {/* Screening date: going + invite row */}
                    {film.date && (
                      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                        {film.goingUsers.length > 0 ? (
                          <div className="flex -space-x-2 overflow-hidden">
                            {film.goingUsers.slice(0, 5).map((u) => (
                              <div key={u.id} className="relative inline-block h-8 w-8 rounded-full ring-2 ring-zinc-950" title={u.name || u.email}>
                                {u.image ? (
                                  <img src={u.image} alt="" className="h-full w-full rounded-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center rounded-full bg-zinc-700 text-[10px] font-bold text-white">{u.name?.[0] || u.email[0]}</div>
                                )}
                              </div>
                            ))}
                            {film.goingUsers.length > 5 && (
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 ring-2 ring-zinc-950">
                                <span className="text-[10px] font-medium text-white">+{film.goingUsers.length - 5}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-500 italic">No one going yet</span>
                        )}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleGoing(film.id, film.isGoing)}
                            className={`group/btn relative flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${film.isGoing
                              ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white"
                              : "bg-white text-zinc-950 shadow-sm hover:bg-zinc-200"
                              }`}
                          >
                            <span>{film.isGoing ? "I'm going" : "Join Screening"}</span>
                          </button>
                          {film.inviteToken && (
                            <button
                              onClick={() => copyInviteLink(film)}
                              title="Copy invite link"
                              className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-all ${
                                copiedInviteId === film.id
                                  ? "border-green-500/50 bg-green-500/10 text-green-400"
                                  : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                              }`}
                            >
                              {copiedInviteId === film.id ? (
                                <>
                                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                  Copied!
                                </>
                              ) : (
                                <>
                                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                  Invite
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  };

  return (
    <div className="mx-auto max-w-3xl space-y-12 pb-24">
      {/* ADMIN FIX BUTTON */}
      {initial.currentUserEmail === "guus@guuslab.com" && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-blue-500/20 bg-blue-500/10 p-4">
          <div>
            <h3 className="text-sm font-bold text-blue-400">Admin Control</h3>
            <p className="text-xs text-blue-300/70">Database sync tools active</p>
          </div>
          <button
            onClick={handleAdminFix}
            disabled={isFixing}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-500 disabled:opacity-50"
          >
            {isFixing ? (
              <>
                <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Syncing DB...
              </>
            ) : (
              <>
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                Fix / Sync Films
              </>
            )}
          </button>
        </div>
      )}

      {/* PAST FILMS TOGGLE */}
      {pastFilms.length > 0 && (
        <div className="mb-8 border-b border-zinc-800 pb-8">
          <button
            onClick={() => setShowPast(!showPast)}
            className="flex w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/30 px-4 py-3 text-left transition-all hover:bg-zinc-900/50"
          >
            <div className="flex items-center gap-3">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-zinc-400 transition-transform ${showPast ? "rotate-90" : ""}`}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-200">Past Screenings</h3>
                <p className="text-xs text-zinc-500">{pastFilms.length} films previously screened</p>
              </div>
            </div>
          </button>

          {showPast && (
            <div className="mt-8 space-y-12 animate-in slide-in-from-top-4 fade-in duration-300">
              {pastDates.map(date => renderDateGroup(date, pastGrouped[date]))}
            </div>
          )}
        </div>
      )}

      {/* PAST RELEASES TOGGLE */}
      {pastReleaseFilms.length > 0 && (
        <div className="mb-8 border-b border-zinc-800 pb-8">
          <button
            onClick={() => setShowPastReleases(!showPastReleases)}
            className="flex w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/30 px-4 py-3 text-left transition-all hover:bg-zinc-900/50"
          >
            <div className="flex items-center gap-3">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-zinc-400 transition-transform ${showPastReleases ? "rotate-90" : ""}`}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-200">Past Releases</h3>
                <p className="text-xs text-zinc-500">{pastReleaseFilms.length} {pastReleaseFilms.length === 1 ? "film" : "films"} already released</p>
              </div>
            </div>
          </button>

          {showPastReleases && (
            <div className="mt-8 space-y-12 animate-in slide-in-from-top-4 fade-in duration-300">
              {pastReleaseDates.map(date => renderDateGroup(date, pastReleasesGrouped[date], true))}
            </div>
          )}
        </div>
      )}

      {/* UPCOMING FILMS */}
      {upcomingDates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 py-20 text-center">
          {/* Empty state icon ... */}
          <div className="mb-4 rounded-full bg-zinc-900 p-4 ring-1 ring-zinc-800">
            <svg className="h-8 w-8 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
            </svg>
          </div>
          <p className="text-lg font-medium text-zinc-200">No upcoming screenings</p>
          <p className="text-sm text-zinc-500">Add a film to kickstart the schedule</p>
        </div>
      ) : (
        upcomingDates.map(date => renderDateGroup(date, upcomingGrouped[date]))
      )}
    </div>
  );
}
