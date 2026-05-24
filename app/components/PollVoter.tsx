"use client";

import { useState } from "react";

type Voter = {
  id: number;
  name: string | null;
  email: string;
  image: string | null;
};

type PollOption = {
  id: number;
  date: string;
  startTime: string | null;
  endTime: string | null;
  voteCount: number;
  voters: Voter[];
  votedByMe: boolean;
  isWinning: boolean;
};

export type Poll = {
  allowMultiVote: boolean;
  options: PollOption[];
  totalVoters: number;
  winningOptionId: number | null;
};

function formatDay(dateStr: string) {
  const d = new Date(dateStr);
  return {
    weekday: d.toLocaleDateString("en-US", { weekday: "short" }),
    month: d.toLocaleDateString("en-US", { month: "short" }),
    day: d.getDate(),
  };
}

export function PollVoter({
  filmId,
  poll: initialPoll,
  canVote,
  compact = false,
}: {
  filmId: number;
  poll: Poll;
  canVote: boolean;
  compact?: boolean;
}) {
  const [poll, setPoll] = useState<Poll>(initialPoll);
  const [pendingId, setPendingId] = useState<number | null>(null);

  const maxVotes = Math.max(1, ...poll.options.map((o) => o.voteCount));
  const hasAnyVotes = poll.options.some((o) => o.voteCount > 0);

  async function toggle(option: PollOption) {
    if (!canVote || pendingId !== null) return;
    setPendingId(option.id);
    const method = option.votedByMe ? "DELETE" : "POST";
    try {
      const res = await fetch(`/api/films/${filmId}/poll/vote`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId: option.id }),
      });
      if (res.ok) {
        const data = (await res.json()) as { poll: Poll | null };
        if (data.poll) setPoll(data.poll);
      }
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-2v13M9 19c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm12-3c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2z" />
          </svg>
          <h4 className="text-sm font-bold text-zinc-100">Pick a screening time</h4>
        </div>
        <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          {poll.allowMultiVote ? "Pick any" : "Pick one"}
        </span>
      </div>

      <div className="space-y-2">
        {poll.options.map((option) => {
          const day = formatDay(option.date);
          const pct = hasAnyVotes ? (option.voteCount / maxVotes) * 100 : 0;
          const isWinner = option.isWinning && hasAnyVotes;
          const isPending = pendingId === option.id;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => toggle(option)}
              disabled={!canVote || isPending}
              className={`group relative w-full overflow-hidden rounded-xl border p-3 text-left transition-all ${
                option.votedByMe
                  ? "border-blue-500/60 bg-blue-500/10"
                  : "border-zinc-800 bg-zinc-950/60 hover:border-zinc-600"
              } ${canVote ? "cursor-pointer" : "cursor-default"} ${isPending ? "opacity-60" : ""}`}
            >
              {/* Vote proportion bar */}
              <div
                className={`absolute inset-y-0 left-0 -z-0 transition-all duration-500 ${
                  isWinner ? "bg-green-500/10" : "bg-zinc-800/40"
                }`}
                style={{ width: `${pct}%` }}
              />

              <div className="relative z-10 flex items-center gap-3">
                {/* Date block */}
                <div
                  className={`flex h-11 w-11 flex-none flex-col items-center justify-center rounded-lg border ${
                    option.votedByMe
                      ? "border-blue-500/50 bg-blue-500/15 text-blue-300"
                      : "border-zinc-700 bg-zinc-900 text-zinc-300"
                  }`}
                >
                  <span className="text-[9px] font-bold uppercase leading-none">{day.month}</span>
                  <span className="text-base font-bold leading-tight">{day.day}</span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-zinc-100">
                      {day.weekday}
                      {option.startTime && (
                        <span className="font-normal text-zinc-400">
                          {" · "}
                          {option.startTime}
                          {option.endTime && ` – ${option.endTime}`}
                        </span>
                      )}
                    </span>
                    {isWinner && (
                      <span className="flex-none rounded-full bg-green-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-green-400">
                        Leading
                      </span>
                    )}
                  </div>

                  <div className="mt-1 flex items-center gap-2">
                    {option.voters.length > 0 ? (
                      <div className="flex -space-x-1.5 overflow-hidden">
                        {option.voters.slice(0, 5).map((v) => (
                          <div
                            key={v.id}
                            className="inline-block h-5 w-5 rounded-full ring-2 ring-zinc-950"
                            title={v.name || v.email}
                          >
                            {v.image ? (
                              <img
                                src={v.image}
                                alt=""
                                className="h-full w-full rounded-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center rounded-full bg-zinc-700 text-[8px] font-bold text-white">
                                {(v.name?.[0] || v.email[0]).toUpperCase()}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <span className="text-xs text-zinc-500">
                      {option.voteCount} {option.voteCount === 1 ? "vote" : "votes"}
                    </span>
                  </div>
                </div>

                {/* Vote indicator */}
                <div
                  className={`flex h-6 w-6 flex-none items-center justify-center rounded-full border transition-all ${
                    option.votedByMe
                      ? "border-blue-500 bg-blue-500 text-white"
                      : "border-zinc-600 bg-transparent text-transparent group-hover:border-zinc-400"
                  }`}
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {!canVote ? (
        <p className="text-center text-xs text-zinc-500">Sign in to cast your vote</p>
      ) : !compact ? (
        <p className="text-center text-[11px] text-zinc-600">
          {hasAnyVotes
            ? "The leading time gets added to your calendar"
            : "Be the first to vote on a time"}
        </p>
      ) : null}
    </div>
  );
}
