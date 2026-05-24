"use client";

import { useState } from "react";
import Link from "next/link";
import { PollVoter, type Poll } from "@/app/components/PollVoter";
import { CommentsSection, type FilmComment } from "@/app/components/CommentsSection";

type Attendee = {
  id: number;
  name: string | null;
  email: string;
  image: string | null;
};

export type FilmDetail = {
  id: number;
  title: string;
  description: string | null;
  formats: string | null;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  releaseDate: string | null;
  posterUrl: string | null;
  inviteToken: string | null;
  creator: { name: string | null; email: string; image: string | null } | null;
};

export type FilmDetailInitial = {
  film: FilmDetail;
  poll: Poll | null;
  goingUsers: Attendee[];
  interestedUsers: Attendee[];
  isGoing: boolean;
  isInterested: boolean;
  canRate: boolean;
  myRating: number | null;
  averageRating: number | null;
  ratingCount: number;
  comments: FilmComment[];
  currentUserId: number;
  isCreator: boolean;
  baseUrl: string;
};

function formatLongDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function PersonRow({ user }: { user: Attendee }) {
  return (
    <div className="flex items-center gap-3">
      {user.image ? (
        <img src={user.image} alt="" className="h-8 w-8 flex-none rounded-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-zinc-700 text-xs font-bold text-white">
          {(user.name?.[0] || user.email[0]).toUpperCase()}
        </div>
      )}
      <span className="truncate text-sm text-zinc-300">{user.name || user.email}</span>
    </div>
  );
}

export function FilmDetailClient({ initial }: { initial: FilmDetailInitial }) {
  const { film } = initial;
  const [goingUsers, setGoingUsers] = useState<Attendee[]>(initial.goingUsers);
  const [interestedUsers, setInterestedUsers] = useState<Attendee[]>(initial.interestedUsers);
  const [isGoing, setIsGoing] = useState(initial.isGoing);
  const [isInterested, setIsInterested] = useState(initial.isInterested);
  const [myRating, setMyRating] = useState(initial.myRating);
  const [averageRating, setAverageRating] = useState(initial.averageRating);
  const [ratingCount, setRatingCount] = useState(initial.ratingCount);
  const [copied, setCopied] = useState(false);

  const formats = film.formats ? film.formats.split(",") : [];

  async function toggleGoing() {
    const method = isGoing ? "DELETE" : "POST";
    const res = await fetch(`/api/films/${film.id}/attend?type=going`, { method });
    if (res.ok) {
      const data = await res.json();
      setGoingUsers(data.attendees ?? goingUsers);
      setIsGoing(!isGoing);
    }
  }

  async function toggleInterested() {
    const method = isInterested ? "DELETE" : "POST";
    const res = await fetch(`/api/films/${film.id}/attend?type=interested`, { method });
    if (res.ok) {
      const data = await res.json();
      setInterestedUsers(data.attendees ?? interestedUsers);
      setIsInterested(!isInterested);
    }
  }

  async function rate(star: number) {
    const res = await fetch(`/api/films/${film.id}/rating`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating: star }),
    });
    if (res.ok) {
      const json = await res.json();
      setMyRating(json.myRating);
      setAverageRating(json.averageRating);
      setRatingCount(json.ratingCount);
    }
  }

  function copyInvite() {
    if (!film.inviteToken) return;
    const url = `${initial.baseUrl}/invite/${film.inviteToken}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="mx-auto max-w-5xl pb-24">
      <Link
        href="/board"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-200"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to board
      </Link>

      {/* HERO */}
      <div className="relative overflow-hidden rounded-3xl border border-zinc-800">
        {film.posterUrl && (
          <div className="absolute inset-0">
            <img src={film.posterUrl} alt="" className="h-full w-full scale-110 object-cover blur-2xl" referrerPolicy="no-referrer" />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-zinc-950/40" />
          </div>
        )}
        <div className="relative flex flex-col gap-6 p-6 sm:flex-row sm:p-8">
          <div className="aspect-[2/3] w-40 flex-none overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl sm:w-48">
            {film.posterUrl ? (
              <img src={film.posterUrl} alt={film.title} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-zinc-700">
                <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
            )}
          </div>

          <div className="flex flex-1 flex-col justify-end gap-3">
            {formats.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {formats.map((fmt) => (
                  <span key={fmt} className="rounded-md border border-zinc-700 bg-zinc-900/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-300">
                    {fmt}
                  </span>
                ))}
              </div>
            )}
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">{film.title}</h1>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-400">
              {initial.poll ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-blue-300">
                  Time poll open
                </span>
              ) : film.date ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-zinc-200">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  {formatLongDate(film.date)}
                  {film.startTime && <span className="text-zinc-400">{" · "}{film.startTime}{film.endTime && ` – ${film.endTime}`}</span>}
                </span>
              ) : (
                <span className="italic text-zinc-500">No screening planned yet</span>
              )}
              {film.releaseDate && (
                <span className="text-zinc-500">Released {formatLongDate(film.releaseDate)}</span>
              )}
            </div>

            {initial.film.creator && (
              <p className="text-xs text-zinc-500">
                Added by {initial.film.creator.name || initial.film.creator.email}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* BODY */}
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {/* MAIN */}
        <div className="space-y-6 lg:col-span-2">
          {film.description && (
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">About</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{film.description}</p>
            </section>
          )}

          {/* Schedule / poll */}
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
            {initial.poll ? (
              <PollVoter filmId={film.id} poll={initial.poll} canVote />
            ) : film.date ? (
              <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Screening</h2>
                  <p className="mt-1 text-lg font-bold text-zinc-100">{formatLongDate(film.date)}</p>
                  {film.startTime && (
                    <p className="text-sm text-zinc-400">{film.startTime}{film.endTime && ` – ${film.endTime}`}</p>
                  )}
                </div>
                <button
                  onClick={toggleGoing}
                  className={`flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all ${
                    isGoing ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700" : "bg-white text-zinc-950 shadow-sm hover:bg-zinc-200"
                  }`}
                >
                  {isGoing ? "I'm going ✓" : "Join screening"}
                </button>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-sm text-zinc-400">No screening planned yet</p>
                <p className="mt-1 text-xs text-zinc-600">Mark yourself interested so the group knows you want to watch</p>
              </div>
            )}
          </section>

          {/* Comments */}
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
            <CommentsSection
              filmId={film.id}
              initialComments={initial.comments}
              canComment
              currentUserId={initial.currentUserId}
              canModerate={initial.isCreator}
            />
          </section>
        </div>

        {/* SIDEBAR */}
        <div className="space-y-6">
          {/* Going */}
          {!initial.poll && (
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">
                Going {goingUsers.length > 0 && <span className="text-zinc-400">· {goingUsers.length}</span>}
              </h2>
              {goingUsers.length > 0 ? (
                <div className="space-y-2.5">
                  {goingUsers.map((u) => <PersonRow key={u.id} user={u} />)}
                </div>
              ) : (
                <p className="text-sm italic text-zinc-600">No one going yet</p>
              )}
            </section>
          )}

          {/* Interested */}
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
                Interested {interestedUsers.length > 0 && <span className="text-zinc-400">· {interestedUsers.length}</span>}
              </h2>
              <button
                onClick={toggleInterested}
                className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all ${
                  isInterested ? "border-amber-500/40 bg-amber-500/10 text-amber-300" : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {isInterested ? "★ Interested" : "☆ Interested"}
              </button>
            </div>
            {interestedUsers.length > 0 ? (
              <div className="space-y-2.5">
                {interestedUsers.map((u) => <PersonRow key={u.id} user={u} />)}
              </div>
            ) : (
              <p className="text-sm italic text-zinc-600">No one interested yet</p>
            )}
          </section>

          {/* Rating */}
          {(ratingCount > 0 || initial.canRate) && (
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">Rating</h2>
              <p className="text-2xl font-bold text-zinc-100">
                {averageRating ? averageRating.toFixed(1) : "—"}
                <span className="text-base font-normal text-zinc-500"> / 5</span>
              </p>
              <p className="text-xs text-zinc-500">{ratingCount} {ratingCount === 1 ? "rating" : "ratings"}</p>
              {initial.canRate && (
                <div className="mt-3 flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => rate(star)}
                      className={`text-2xl transition-colors ${(myRating ?? 0) >= star ? "text-amber-400" : "text-zinc-700 hover:text-zinc-400"}`}
                      aria-label={`Rate ${star} stars`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Share */}
          {film.inviteToken && (
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">Share</h2>
              <button
                onClick={copyInvite}
                className={`flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-all ${
                  copied ? "border-green-500/50 bg-green-500/10 text-green-400" : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500"
                }`}
              >
                {copied ? "Invite link copied!" : "Copy invite link"}
              </button>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
