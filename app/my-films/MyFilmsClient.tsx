"use client";

import { useEffect, useState } from "react";

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
  date: string;
  releaseDate: string | null;
  startTime: string | null;
  endTime: string | null;
  posterUrl: string | null;
  createdBy: number;
  isAttending: boolean;
  attendeeCount: number;
  creator: {
    name: string | null;
    email: string;
    image: string | null;
  };
  attendees: Attendee[];
};

type InitialData = {
  films: Film[];
  currentUserId: number;
};

export function MyFilmsClient({ initial }: { initial: InitialData }) {
  const [films, setFilms] = useState<Film[]>(initial.films);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    date: "",
    releaseDate: "",
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
          releaseDate: form.releaseDate || null,
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
        releaseDate: "",
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
      await refresh();
    }
  }

  async function handleToggleAttending(filmId: number, isCurrentlyAttending: boolean) {
    const method = isCurrentlyAttending ? "DELETE" : "POST";
    const res = await fetch(`/api/films/${filmId}/attend`, { method });
    if (res.ok) {
      await refresh();
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-950 p-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-50">Add Film</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Add a new film to the shared board
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2 space-y-2">
              <label className="block text-sm font-medium text-zinc-300">
                Title <span className="text-red-400">*</span>
              </label>
              <input
                required
                placeholder="Enter film title"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-zinc-600"
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-zinc-300">
                Screening Date <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                required
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-600"
                value={form.date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, date: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-zinc-300">
                Release Date
              </label>
              <input
                type="date"
                placeholder="Official release date"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-600"
                value={form.releaseDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, releaseDate: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-zinc-300">
                Start Time
              </label>
              <input
                type="time"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-600"
                value={form.startTime}
                onChange={(e) =>
                  setForm((f) => ({ ...f, startTime: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-zinc-300">
                End Time
              </label>
              <input
                type="time"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-600"
                value={form.endTime}
                onChange={(e) =>
                  setForm((f) => ({ ...f, endTime: e.target.value }))
                }
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="block text-sm font-medium text-zinc-300">
                Description
              </label>
              <textarea
                rows={3}
                placeholder="Add film description..."
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-zinc-600"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="block text-sm font-medium text-zinc-300">
                Poster Image
              </label>
              <div className="flex items-center gap-3">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:bg-zinc-800">
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  Choose File
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setForm((f) => ({ ...f, posterFile: file }));
                    }}
                  />
                </label>
                {form.posterFile && (
                  <span className="text-sm text-zinc-400">
                    {form.posterFile.name}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="h-4 w-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Adding...
              </span>
            ) : (
              "Add Film"
            )}
          </button>
        </form>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-50">All Films</h2>
          <p className="text-sm text-zinc-400">
            {films.length} film{films.length !== 1 ? "s" : ""} on the board
          </p>
        </div>

        {films.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-800 bg-zinc-950 py-12">
            <svg
              className="mb-3 h-12 w-12 text-zinc-700"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
              />
            </svg>
            <p className="text-sm font-medium text-zinc-400">No films yet</p>
            <p className="text-xs text-zinc-500">
              Add your first film to get started
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {films.map((film) => (
              <div
                key={film.id}
                className="group rounded-lg border border-zinc-800 bg-zinc-950 p-4 transition-colors hover:border-zinc-700"
              >
                <div className="flex gap-4">
                  {film.posterUrl ? (
                    <img
                      src={film.posterUrl}
                      alt={film.title}
                      className="h-32 w-24 rounded-md object-cover"
                    />
                  ) : (
                    <div className="flex h-32 w-24 items-center justify-center rounded-md bg-zinc-900">
                      <svg
                        className="h-8 w-8 text-zinc-700"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
                        />
                      </svg>
                    </div>
                  )}

                  <div className="flex-1 space-y-2">
                    <div>
                      <h3 className="font-medium text-zinc-100">
                        {film.title}
                      </h3>
                      <p className="text-xs text-zinc-500">
                        Added by {film.creator.name || film.creator.email}
                      </p>
                    </div>

                    {film.description && (
                      <p className="text-xs text-zinc-400 line-clamp-2">
                        {film.description}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
                      <span className="flex items-center gap-1">
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
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        {new Date(film.date).toLocaleDateString()}
                      </span>
                      {film.startTime && (
                        <span className="flex items-center gap-1">
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
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          handleToggleAttending(film.id, film.isAttending)
                        }
                        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${film.isAttending
                            ? "bg-blue-600 text-white hover:bg-blue-700"
                            : "border border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800"
                          }`}
                      >
                        {film.isAttending ? (
                          <>
                            <svg
                              className="h-3.5 w-3.5"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                            I'm going
                          </>
                        ) : (
                          "I'm going"
                        )}
                      </button>

                      <span className="text-xs text-zinc-500">
                        {film.attendeeCount} going
                      </span>

                      {film.createdBy === initial.currentUserId && (
                        <button
                          onClick={() => handleDelete(film.id)}
                          className="ml-auto rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:border-red-900 hover:bg-red-950 hover:text-red-400"
                        >
                          Delete
                        </button>
                      )}
                    </div>

                    {film.attendees.length > 0 && (
                      <div className="pt-2 border-t border-zinc-800">
                        <p className="text-xs font-medium text-zinc-400 mb-1.5">
                          Attending:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {film.attendees.map((attendee) => (
                            <div
                              key={attendee.id}
                              className="flex items-center gap-1.5 rounded-full bg-zinc-900 px-2 py-1"
                            >
                              {attendee.image ? (
                                <img
                                  src={attendee.image}
                                  alt={attendee.name || attendee.email}
                                  className="h-4 w-4 rounded-full"
                                />
                              ) : (
                                <div className="h-4 w-4 rounded-full bg-zinc-700" />
                              )}
                              <span className="text-xs text-zinc-400">
                                {attendee.name || attendee.email}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
