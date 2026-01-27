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
  isOnMainBoard: boolean;
};

type InitialData = {
  films: Film[];
};

export function MyFilmsClient({ initial }: { initial: InitialData }) {
  const [films, setFilms] = useState<Film[]>(initial.films);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    date: "",
    startTime: "",
    endTime: "",
    description: "",
    posterFile: null as File | null,
  });

  async function refresh() {
    const res = await fetch("/api/films");
    if (!res.ok) return;
    const data = (await res.json()) as { films: Film[] };
    setFilms(data.films);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      let posterUrl: string | undefined;
      if (form.posterFile) {
        const fd = new FormData();
        fd.append("file", form.posterFile);
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: fd,
        });
        if (!uploadRes.ok) {
          throw new Error("Upload failed");
        }
        const uploadJson = (await uploadRes.json()) as { url: string };
        posterUrl = uploadJson.url;
      }

      const res = await fetch("/api/films", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: form.title,
          date: form.date,
          startTime: form.startTime || null,
          endTime: form.endTime || null,
          description: form.description || null,
          posterUrl: posterUrl ?? null,
        }),
      });

      if (!res.ok) {
        console.error(await res.text());
        return;
      }

      setForm({
        title: "",
        date: "",
        startTime: "",
        endTime: "",
        description: "",
        posterFile: null,
      });
      await refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number) {
    const res = await fetch(`/api/films/${id}`, { method: "DELETE" });
    if (res.ok) {
      setFilms((prev) => prev.filter((f) => f.id !== id));
    }
  }

  async function handleSendToBoard(id: number) {
    const res = await fetch(`/api/films/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isOnMainBoard: true }),
    });
    if (res.ok) {
      await refresh();
    }
  }

  return (
    <div className="space-y-10">
      <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950 p-6">
        <h1 className="text-lg font-semibold text-zinc-50">
          Your personal film list
        </h1>
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2 space-y-1">
            <label className="text-xs text-zinc-400">Title</label>
            <input
              required
              className="w-full rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-zinc-400">Date</label>
            <input
              type="date"
              required
              className="w-full rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
              value={form.date}
              onChange={(e) =>
                setForm((f) => ({ ...f, date: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-zinc-400">Start time</label>
            <input
              type="time"
              className="w-full rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
              value={form.startTime}
              onChange={(e) =>
                setForm((f) => ({ ...f, startTime: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-zinc-400">End time</label>
            <input
              type="time"
              className="w-full rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
              value={form.endTime}
              onChange={(e) =>
                setForm((f) => ({ ...f, endTime: e.target.value }))
              }
            />
          </div>
          <div className="md:col-span-2 space-y-1">
            <label className="text-xs text-zinc-400">Description</label>
            <textarea
              className="min-h-[80px] w-full rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-zinc-400">Poster image</label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setForm((f) => ({ ...f, posterFile: file }));
              }}
              className="block w-full text-xs text-zinc-400 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-xs file:font-medium file:text-zinc-100"
            />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center rounded-md bg-zinc-100 px-4 py-2 text-xs font-medium text-black disabled:opacity-60"
            >
              {loading ? "Saving..." : "Add film"}
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-100">
            Your films ({films.length})
          </h2>
        </div>
        <div className="space-y-3">
          {films.length === 0 && (
            <p className="text-sm text-zinc-500">
              No films yet. Add your first one above.
            </p>
          )}
          {films.map((film) => (
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
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-zinc-100">
                      {film.title}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {film.date}{" "}
                      {film.startTime &&
                        `· ${film.startTime}${
                          film.endTime ? ` – ${film.endTime}` : ""
                        }`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {!film.isOnMainBoard && (
                      <button
                        onClick={() => handleSendToBoard(film.id)}
                        className="rounded-md bg-zinc-100 px-3 py-1 text-xs font-medium text-black"
                      >
                        Send to board
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(film.id)}
                      className="rounded-md border border-zinc-700 px-3 py-1 text-xs text-zinc-300"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {film.description && (
                  <p className="text-xs text-zinc-400">{film.description}</p>
                )}
                {film.isOnMainBoard && (
                  <p className="text-[11px] text-emerald-400">
                    On shared board
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

