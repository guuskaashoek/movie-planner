"use client";

import { useState } from "react";
import Link from "next/link";

export function HeartIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />
    </svg>
  );
}

function TicketIcon({ checked = false }: { checked?: boolean }) {
  return (
    <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h16v5a2 2 0 0 0 0 4v5H4v-5a2 2 0 0 0 0-4Z" />
      {checked ? <path d="m8 12 2.5 2.5L16 9" strokeLinecap="round" strokeLinejoin="round" /> : <path d="M15 5v3m0 8v3" />}
    </svg>
  );
}

export function FilmQuickActions({
  title,
  liked,
  going,
  hasScreening,
  hasPoll,
  likes,
  goingCount,
  href,
  onLike,
  onGoing,
  compact = false,
  tone = "default",
}: {
  title: string;
  liked: boolean;
  going: boolean;
  hasScreening: boolean;
  hasPoll: boolean;
  likes: number;
  goingCount: number;
  href: string;
  onLike: () => Promise<void>;
  onGoing: () => Promise<void>;
  compact?: boolean;
  tone?: "default" | "on-media";
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(action: () => Promise<void>) {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await action();
    } catch {
      setError("Couldn’t save. Try again.");
    } finally {
      setPending(false);
    }
  }

  const onMedia = tone === "on-media";
  const base = onMedia
    ? "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full px-3 text-xs font-medium text-white backdrop-blur-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-200 disabled:opacity-50"
    : "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-200 disabled:opacity-50";
  const goingClass = onMedia
    ? going
      ? "bg-[var(--cinema-accent,#e4ff6a)] text-zinc-950 hover:bg-lime-100"
      : "bg-white/12 hover:bg-white/20"
    : going
      ? "bg-lime-200 text-zinc-950 hover:bg-lime-100"
      : "bg-zinc-100 text-zinc-950 hover:bg-white";
  const likeClass = onMedia
    ? liked
      ? "bg-rose-500/20 text-rose-200 hover:bg-rose-500/30"
      : "bg-white/12 text-white hover:bg-white/20"
    : liked
      ? "text-rose-400 hover:bg-rose-400/10"
      : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200";

  return (
    <div>
      <div className={`flex items-center gap-2 ${compact && !onMedia ? "mt-2" : ""}`}>
        {hasPoll ? (
          <Link
            href={href}
            title={`Vote on a date for ${title}`}
            aria-label={`Vote on a date for ${title}`}
            className={`${base} ${compact ? "flex-1" : ""} ${onMedia ? "bg-white/12 hover:bg-white/20" : "bg-zinc-100 text-zinc-950 hover:bg-white"}`}
          >
            <TicketIcon />
            {!compact ? "Pick a date" : goingCount > 0 ? goingCount : null}
          </Link>
        ) : (
          hasScreening && (
            <button
              type="button"
              disabled={pending}
              title={going ? "I'm going · click to leave" : "I'm going"}
              aria-label={`${going ? "Leave screening of" : "I'm going to"} ${title}`}
              aria-pressed={going}
              onClick={() => run(onGoing)}
              className={`${base} ${compact && !onMedia ? "flex-1" : ""} ${goingClass}`}
            >
              <TicketIcon checked={going} />
              {!compact ? "I'm going" : goingCount > 0 ? goingCount : null}
            </button>
          )
        )}
        <button
          type="button"
          disabled={pending}
          title={liked ? "Unlike film" : "Like film"}
          aria-label={`${liked ? "Unlike" : "Like"} ${title}`}
          aria-pressed={liked}
          onClick={() => run(onLike)}
          className={`${base} ${likeClass}`}
        >
          <HeartIcon filled={liked} />
          {likes > 0 && <span>{likes}</span>}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-rose-300">
          {error}
        </p>
      )}
    </div>
  );
}
