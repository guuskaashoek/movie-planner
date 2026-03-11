"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function InviteJoinButton({ filmId }: { filmId: number }) {
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);

  async function handleJoin() {
    setJoining(true);
    const res = await fetch(`/api/films/${filmId}/attend`, { method: "POST" });
    if (res.ok) {
      setJoined(true);
    }
    setJoining(false);
  }

  if (joined) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-xl border border-green-500/30 bg-green-500/10 px-5 py-4">
          <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-green-500/20 text-green-400">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-green-300">You're going!</p>
            <p className="text-xs text-green-400/70">You've been added to this screening</p>
          </div>
        </div>
        <button
          onClick={() => router.push("/board")}
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-3 text-sm font-semibold text-zinc-300 transition-all hover:bg-zinc-800 hover:text-white"
        >
          View Calendar Board
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleJoin}
      disabled={joining}
      className="w-full rounded-xl bg-white px-5 py-3.5 text-sm font-bold text-zinc-950 shadow-lg transition-all hover:bg-zinc-100 disabled:opacity-50"
    >
      {joining ? "Joining..." : "Join Screening"}
    </button>
  );
}
