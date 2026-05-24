"use client";

import { useState } from "react";

export type FilmComment = {
  id: number;
  body: string;
  createdAt: number;
  author: {
    id: number;
    name: string | null;
    email: string;
    image: string | null;
  };
};

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(ts).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

function Avatar({ name, email, image }: { name: string | null; email: string; image: string | null }) {
  if (image) {
    return (
      <img src={image} alt="" className="h-9 w-9 flex-none rounded-full object-cover" referrerPolicy="no-referrer" />
    );
  }
  return (
    <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-zinc-700 text-sm font-bold text-white">
      {(name?.[0] || email[0]).toUpperCase()}
    </div>
  );
}

export function CommentsSection({
  filmId,
  initialComments,
  canComment,
  currentUserId,
  canModerate = false,
}: {
  filmId: number;
  initialComments: FilmComment[];
  canComment: boolean;
  currentUserId: number | null;
  canModerate?: boolean;
}) {
  const [comments, setComments] = useState<FilmComment[]>(initialComments);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || posting) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/films/${filmId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmed }),
      });
      if (res.ok) {
        const data = (await res.json()) as { comments: FilmComment[] };
        setComments(data.comments);
        setBody("");
      }
    } finally {
      setPosting(false);
    }
  }

  async function remove(id: number) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/films/${filmId}/comments/${id}`, { method: "DELETE" });
      if (res.ok) {
        const data = (await res.json()) as { comments: FilmComment[] };
        setComments(data.comments);
      }
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <svg className="h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h6m-6 8l-4-4V6a2 2 0 012-2h16a2 2 0 012 2v8a2 2 0 01-2 2H7l-4 4z" />
        </svg>
        <h3 className="text-base font-bold text-zinc-100">
          Comments {comments.length > 0 && <span className="text-zinc-500">({comments.length})</span>}
        </h3>
      </div>

      {canComment ? (
        <form onSubmit={submit} className="space-y-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a comment…"
            rows={3}
            maxLength={2000}
            className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={posting || !body.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-500 disabled:opacity-40"
            >
              {posting ? "Posting…" : "Post comment"}
            </button>
          </div>
        </form>
      ) : (
        <p className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-3 text-center text-sm text-zinc-500">
          Sign in to join the conversation
        </p>
      )}

      <div className="space-y-3">
        {comments.length === 0 ? (
          <p className="py-6 text-center text-sm italic text-zinc-600">No comments yet — be the first to say something.</p>
        ) : (
          comments.map((c) => {
            const canDelete = canModerate || c.author.id === currentUserId;
            return (
              <div key={c.id} className="flex gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
                <Avatar name={c.author.name} email={c.author.email} image={c.author.image} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-zinc-200">
                      {c.author.name || c.author.email}
                    </span>
                    <span className="flex-none text-xs text-zinc-500">{timeAgo(c.createdAt)}</span>
                    {canDelete && (
                      <button
                        onClick={() => remove(c.id)}
                        disabled={deletingId === c.id}
                        className="ml-auto flex-none rounded-md p-1 text-zinc-600 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
                        title="Delete comment"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-zinc-300">{c.body}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
