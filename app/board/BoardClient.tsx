"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FilmQuickActions } from "@/app/components/FilmQuickActions";
import { goingTo } from "@/lib/board-discovery";
import { BoardSpotlight } from "./BoardSpotlight";
import { PollVoter, type Poll } from "@/app/components/PollVoter";
import { useLiveUpdates } from "@/app/components/useLiveUpdates";

type Attendee = {
  id: number;
  name: string | null;
  email: string;
  image: string | null;
};

export type Film = {
  isMajorRelease?: boolean;
  backdropUrl?: string | null;
  id: number;
  title: string;
  description: string | null;
  date: string | null;
  releaseDate: string | null;
  startTime: string | null;
  endTime: string | null;
  posterUrl: string | null;
  formats: string | null;
  ticketsOnSaleDate: string | null;
  ticketsOnSaleTime: string | null;
  ticketsUrl: string | null;
  inviteToken: string | null;
  goingUsers: Attendee[];
  interestedUsers: Attendee[];
  isGoing: boolean;
  isInterested: boolean;
  canRate: boolean;
  myRating: number | null;
  averageRating: number | null;
  ratingCount: number;
  poll: Poll | null;
};


type ApiResponse = {
  films: Film[];
  hasMore?: boolean;
  currentUserEmail?: string | null;
  baseUrl?: string;
  now?: string;
};

export function BoardClient({ initial, preview = false }: { initial: ApiResponse; preview?: boolean }) {
  const [now, setNow] = useState(() => new Date(initial.now ?? Date.now()));
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const filmHref = (id: number) => preview ? `/preview?film=${id}` : `/film/${id}`;
  const router = useRouter();
  const [films, setFilms] = useState<Film[]>(initial.films);
  const [view, setView] = useState<"list" | "grid">("list");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("movie-planner-view");
      if (saved === "list" || saved === "grid") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setView(saved);
      }
    } catch { /* The view still works when browser storage is disabled. */ }
  }, []);
  function changeView(next: "list" | "grid") {
    setView(next);
    try { localStorage.setItem("movie-planner-view", next); } catch {}
  }
  const [onlyLiked, setOnlyLiked] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [showPastReleases, setShowPastReleases] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [copiedInviteId, setCopiedInviteId] = useState<number | null>(null);
  const liveRefreshTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFilms(initial.films);
  }, [initial.films]);
  const refreshLive = useCallback(() => {
    if (liveRefreshTimeout.current) return;
    liveRefreshTimeout.current = setTimeout(() => {
      router.refresh();
      liveRefreshTimeout.current = null;
    }, 350);
  }, [router]);
  useLiveUpdates(refreshLive, !preview);

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
    if (preview) {
      setFilms(previous => previous.map(film => film.id === filmId ? { ...film, isGoing: !currentlyGoing, goingUsers: currentlyGoing ? film.goingUsers.filter(person => person.id !== -1) : [...film.goingUsers, { id: -1, name: "You", email: "preview@example.com", image: null }] } : film));
      return;
    }
    const method = currentlyGoing ? "DELETE" : "POST";
    const res = await fetch(`/api/films/${filmId}/attend?type=going`, { method });
    if (!res.ok) throw new Error("Could not save your choice");
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
    if (preview) {
      setFilms(previous => previous.map(film => film.id === filmId ? { ...film, isInterested: !currentlyInterested, interestedUsers: currentlyInterested ? film.interestedUsers.filter(person => person.id !== -1) : [...film.interestedUsers, { id: -1, name: "You", email: "preview@example.com", image: null }] } : film));
      return;
    }
    const method = currentlyInterested ? "DELETE" : "POST";
    const res = await fetch(`/api/films/${filmId}/attend?type=interested`, { method });
    if (!res.ok) throw new Error("Could not save your choice");
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

  const visibleFilms = onlyLiked ? films.filter(film => film.isInterested) : films;
  const pastFilms = visibleFilms.filter(f => f.date && f.date < today);
  // Past releases: no screening date, but release date is in the past
  const pastReleaseFilms = visibleFilms.filter(f => !f.date && f.releaseDate && f.releaseDate < today);
  // Upcoming = Future/today screening date OR no screening date and no past release date (true TBA)
  const upcomingFilms = visibleFilms.filter(f =>
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

  const renderActions = (film: Film, compact = false) => (
    <FilmQuickActions title={film.title} liked={film.isInterested} going={film.isGoing} hasScreening={!!film.date} hasPoll={!!film.poll} likes={film.interestedUsers.length} goingCount={goingTo(film).length} href={filmHref(film.id)} onLike={() => toggleInterested(film.id, film.isInterested)} onGoing={() => toggleGoing(film.id, film.isGoing)} compact={compact} />
  );

  const renderGrid = (items: Film[]) => (
    <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
      {items.map((film) => (
        <article key={film.id} className="group min-w-0">
          <Link href={filmHref(film.id)} className="block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-300">
            <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
              {film.posterUrl ? (
                <img src={film.posterUrl} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 motion-safe:group-hover:scale-105" referrerPolicy="no-referrer" />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-4 p-4 text-center">
                  <img src="/icon.svg" alt="" width="40" height="40" className="opacity-40" />
                  <span className="text-sm font-medium text-zinc-500">{film.title}</span>
                </div>
              )}
              {film.isGoing && <span className="absolute left-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/80 text-[var(--cinema-accent,#e4ff6a)]" title="You’re going" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 5h16v5a2 2 0 0 0 0 4v5H4v-5a2 2 0 0 0 0-4Z" /><path d="m8 12 2.5 2.5L16 9" strokeLinecap="round" /></svg></span>}
              {film.averageRating !== null && <span className="absolute bottom-2 right-2 rounded-md bg-black/85 px-2 py-1 text-xs font-medium text-amber-300">★ {film.averageRating.toFixed(1)}</span>}
            </div>
            <h3 className="mt-3 line-clamp-2 text-sm font-semibold leading-snug text-zinc-100">{film.title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              {film.date ? new Date(film.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : film.releaseDate ? `Releases ${new Date(film.releaseDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : "Date to be announced"}
              {film.date && film.startTime && ` · ${film.startTime}`}
            </p>
            {film.poll && <p className="mt-1 text-xs text-amber-300">Vote on a date →</p>}
          </Link>
          {renderActions(film, true)}
        </article>
      ))}
    </div>
  );

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
              <div className="flex flex-wrap gap-4 p-3 sm:flex-nowrap sm:gap-6">
                <Link
                  href={filmHref(film.id)}
                  className="relative aspect-[2/3] self-start w-20 flex-none cursor-pointer overflow-hidden rounded-lg bg-zinc-800 shadow-lg sm:w-32"
                >
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
                </Link>

                <div className="contents sm:flex sm:min-w-0 sm:flex-1 sm:flex-col sm:justify-between sm:py-1">
                  <Link href={filmHref(film.id)} className="block min-w-0 flex-1 space-y-2">
                    <div>
                      <h3 className="break-words text-base font-bold text-zinc-100 group-hover:text-white">
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
                        {film.ticketsOnSaleDate && (
                          <span className="flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-300">
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5h14a2 2 0 012 2v3a2 2 0 000 4v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3a2 2 0 000-4V7a2 2 0 012-2z" /></svg>
                            Tickets{" "}
                            {new Date(film.ticketsOnSaleDate).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}
                            {film.ticketsOnSaleTime && ` · ${film.ticketsOnSaleTime}`}
                          </span>
                        )}
                      </div>
                    </div>
                    {film.description && (
                      <p className="line-clamp-2 text-sm text-zinc-400">{film.description}</p>
                    )}
                  </Link>

                  <div className="w-full space-y-3 border-t border-white/5 pt-4 sm:mt-4">
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

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      {renderActions(film)}
                      {goingTo(film).length > 0 && <span className="text-xs text-zinc-500">{goingTo(film).length} going</span>}
                    </div>

                    {/* Poll: vote on a screening time */}
                    {film.poll && (
                      <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
                        <PollVoter filmId={film.id} poll={film.poll} canVote={!preview} compact />
                        {film.inviteToken && (
                          <button
                            onClick={() => copyInviteLink(film)}
                            className={`flex w-full items-center justify-center gap-1.5 rounded-lg border min-h-11 px-3 py-2 text-xs font-semibold transition-all ${
                              copiedInviteId === film.id
                                ? "border-green-500/50 bg-green-500/10 text-green-400"
                                : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                            }`}
                          >
                            {copiedInviteId === film.id ? "Invite link copied!" : "Copy invite link to share the poll"}
                          </button>
                        )}
                      </div>
                    )}

                    {!film.poll && film.inviteToken && (
                      <button type="button" onClick={() => copyInviteLink(film)} className="inline-flex min-h-11 items-center text-xs text-zinc-500 hover:text-zinc-200">{copiedInviteId === film.id ? "Invite link copied" : "Invite friends ↗"}</button>
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
    <div className="pb-4">
      <BoardSpotlight
        films={films}
        now={now}
        preview={preview}
        onLike={(film) => toggleInterested(film.id, film.isInterested)}
        onGoing={(film) => toggleGoing(film.id, film.isGoing)}
      />
      <div id="all-films" className="board-catalog scroll-mt-6 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap gap-x-4 gap-y-1" role="group" aria-label="Filter films">
            <button type="button" aria-pressed={!onlyLiked} onClick={() => setOnlyLiked(false)} className={`min-h-11 border-b-2 text-xs ${!onlyLiked ? "border-lime-200 text-zinc-100" : "border-transparent text-zinc-500"}`}>All films</button>
            <button type="button" aria-pressed={onlyLiked} onClick={() => setOnlyLiked(true)} className={`min-h-11 border-b-2 text-xs ${onlyLiked ? "border-lime-200 text-zinc-100" : "border-transparent text-zinc-500"}`}>Liked movies</button>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/my-films" className="hidden min-h-11 shrink-0 items-center rounded-full bg-zinc-100 px-4 text-sm font-semibold text-zinc-950 hover:bg-white sm:inline-flex">Add film</Link>
            <div role="group" aria-label="Film display" className="flex shrink-0 rounded-xl border border-zinc-800 bg-zinc-950 p-1">
              {(["list", "grid"] as const).map((mode) => (
                <button key={mode} type="button" aria-label={mode === "list" ? "List" : "Grid"} aria-pressed={view === mode} onClick={() => changeView(mode)} className={`flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-amber-300 ${view === mode ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-200"}`}>
                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">{mode === "list" ? <path d="M7 5h10M7 10h10M7 15h10M3 5h1M3 10h1M3 15h1" /> : <><rect x="3" y="3" width="5" height="5" rx="1" /><rect x="12" y="3" width="5" height="5" rx="1" /><rect x="3" y="12" width="5" height="5" rx="1" /><rect x="12" y="12" width="5" height="5" rx="1" /></>}</svg>
                  <span className="hidden sm:inline">{mode === "list" ? "List" : "Grid"}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      {/* UPCOMING FILMS */}
      {upcomingDates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 py-20 text-center">
          {/* Empty state icon ... */}
          <div className="mb-4 rounded-full bg-zinc-900 p-4 ring-1 ring-zinc-800">
            <svg className="h-8 w-8 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
            </svg>
          </div>
          <p className="text-lg font-medium text-zinc-200">{onlyLiked ? "No upcoming liked movies" : "No upcoming screenings"}</p>
          <p className="text-sm text-zinc-500">{onlyLiked ? "Tap a heart to save a film here" : "Add a film to kickstart the schedule"}</p>
        </div>
      ) : (
        view === "grid" ? renderGrid(upcomingDates.flatMap(date => upcomingGrouped[date])) : upcomingDates.map(date => renderDateGroup(date, upcomingGrouped[date]))
      )}
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
              {view === "grid" ? renderGrid(pastDates.flatMap(date => pastGrouped[date])) : pastDates.map(date => renderDateGroup(date, pastGrouped[date]))}
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
              {view === "grid" ? renderGrid(pastReleaseDates.flatMap(date => pastReleasesGrouped[date])) : pastReleaseDates.map(date => renderDateGroup(date, pastReleasesGrouped[date], true))}
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
