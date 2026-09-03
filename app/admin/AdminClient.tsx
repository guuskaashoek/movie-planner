"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type AdminUser = {
  id: number;
  email: string;
  name: string | null;
  role: "user" | "admin";
  filmCount: number;
  createdAt: number;
  isBootstrapAdmin: boolean;
};

type AdminFilm = {
  id: number;
  title: string;
  date: string | null;
  startTime: string | null;
  releaseDate: string | null;
  ticketsOnSaleDate: string | null;
  ticketsOnSaleTime: string | null;
  posterUrl: string | null;
  createdBy: number;
  ownerName: string;
  attendeeCount: number;
  ratingCount: number;
  averageRating: number | null;
  hasPoll: boolean;
};

type Props = {
  currentUserId: number;
  stats: {
    totals: {
      films: number;
      users: number;
      comments: number;
      votes: number;
      ratings: number;
      upcomingFilms: number;
    };
  };
  users: AdminUser[];
  films: AdminFilm[];
  total: number;
};

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 font-mono text-xl text-zinc-100">{value}</p>
    </div>
  );
}

export function AdminClient({ currentUserId, stats, users, films, total }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const visibleFilms = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return films;
    return films.filter(
      (f) =>
        f.title.toLowerCase().includes(needle) || f.ownerName.toLowerCase().includes(needle)
    );
  }, [films, filter]);

  async function run(key: string, fn: () => Promise<Response>) {
    setBusy(key);
    setError(null);
    try {
      const res = await fn();
      if (!res.ok) throw new Error((await res.text()) || "Request failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  function changeRole(user: AdminUser, role: "user" | "admin") {
    return run(`role-${user.id}`, () =>
      fetch(`/api/admin/users/${user.id}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      })
    );
  }

  function transfer(film: AdminFilm, ownerId: string) {
    if (!ownerId || Number(ownerId) === film.createdBy) return;
    return run(`transfer-${film.id}`, () =>
      fetch(`/api/admin/films/${film.id}/transfer`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: Number(ownerId) }),
      })
    );
  }

  function remove(film: AdminFilm) {
    if (
      !confirm(
        `Delete "${film.title}" for everyone? Its poll, comments and ratings go with it.`
      )
    ) {
      return;
    }
    return run(`delete-${film.id}`, () => fetch(`/api/films/${film.id}`, { method: "DELETE" }));
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Admin</h1>
          <p className="text-sm text-zinc-400">
            You can edit, move and delete every member&apos;s films here and from the board.
          </p>
        </div>
        <Link
          href="/settings"
          className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-500 hover:bg-zinc-900 hover:text-white"
        >
          MCP keys
        </Link>
      </header>

      {error && (
        <p className="rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Tile label="Films" value={stats.totals.films} />
        <Tile label="Upcoming" value={stats.totals.upcomingFilms} />
        <Tile label="Members" value={stats.totals.users} />
        <Tile label="Comments" value={stats.totals.comments} />
        <Tile label="Votes" value={stats.totals.votes} />
        <Tile label="Ratings" value={stats.totals.ratings} />
      </section>

      {/* Members ------------------------------------------------------- */}
      <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
        <h2 className="text-sm font-semibold text-zinc-100">Members</h2>
        <p className="mt-1 text-xs text-zinc-400">
          Admins can manage every film, in the app and through their MCP key.
        </p>

        <ul className="mt-4 space-y-2">
          {users.map((user) => (
            <li
              key={user.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-zinc-800 bg-black px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-zinc-200">
                  {user.name ?? user.email}
                  {user.id === currentUserId && (
                    <span className="ml-2 text-[11px] text-zinc-500">(you)</span>
                  )}
                </p>
                <p className="truncate text-[11px] text-zinc-500">
                  {user.email} · {user.filmCount} film{user.filmCount === 1 ? "" : "s"}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={
                    user.role === "admin"
                      ? "rounded-md border border-amber-500/50 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-300"
                      : "rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-zinc-400"
                  }
                >
                  {user.role}
                </span>

                {user.isBootstrapAdmin ? (
                  <span
                    className="text-[11px] text-zinc-600"
                    title="Admin through the ADMIN_EMAILS environment variable"
                  >
                    from env
                  </span>
                ) : user.role === "admin" ? (
                  <button
                    type="button"
                    disabled={busy === `role-${user.id}` || user.id === currentUserId}
                    onClick={() => changeRole(user, "user")}
                    className="rounded-md border border-zinc-700 px-3 py-1 text-[11px] text-zinc-300 transition-colors hover:border-zinc-500 hover:bg-zinc-900 disabled:opacity-40"
                  >
                    Make member
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy === `role-${user.id}`}
                    onClick={() => changeRole(user, "admin")}
                    className="rounded-md border border-amber-600/50 px-3 py-1 text-[11px] text-amber-300 transition-colors hover:bg-amber-500/10 disabled:opacity-40"
                  >
                    Make admin
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Films --------------------------------------------------------- */}
      <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">All films</h2>
            <p className="mt-1 text-xs text-zinc-400">
              Showing {visibleFilms.length} of {total}.
            </p>
          </div>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by title or owner"
            className="w-56 rounded-md border border-zinc-800 bg-black px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
          />
        </div>

        <ul className="mt-4 space-y-2">
          {visibleFilms.map((film) => (
            <li
              key={film.id}
              className="flex flex-wrap items-center gap-3 rounded-md border border-zinc-800 bg-black px-4 py-3"
            >
              {film.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={film.posterUrl}
                  alt=""
                  className="h-14 w-10 shrink-0 rounded border border-zinc-800 object-cover"
                />
              ) : (
                <div className="h-14 w-10 shrink-0 rounded border border-zinc-800 bg-zinc-900" />
              )}

              <div className="min-w-0 flex-1">
                <Link
                  href={`/film/${film.id}`}
                  className="truncate text-sm text-zinc-100 hover:underline"
                >
                  {film.title}
                </Link>
                <p className="mt-0.5 truncate text-[11px] text-zinc-500">
                  {film.date ?? film.releaseDate ?? (film.hasPoll ? "poll running" : "no date")}
                  {film.startTime ? ` · ${film.startTime}` : ""} · owner {film.ownerName} ·{" "}
                  {film.attendeeCount} going
                  {film.averageRating != null && ` · ★ ${film.averageRating}`}
                </p>
                {film.ticketsOnSaleDate && (
                  <p className="mt-0.5 text-[11px] text-amber-400/80">
                    Tickets on sale {film.ticketsOnSaleDate}
                    {film.ticketsOnSaleTime ? ` at ${film.ticketsOnSaleTime}` : ""}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <select
                  defaultValue={String(film.createdBy)}
                  disabled={busy === `transfer-${film.id}`}
                  onChange={(e) => transfer(film, e.target.value)}
                  className="rounded-md border border-zinc-800 bg-black px-2 py-1 text-[11px] text-zinc-300 focus:border-zinc-600 focus:outline-none"
                  title="Transfer ownership"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name ?? u.email}
                    </option>
                  ))}
                </select>

                <Link
                  href={`/my-films?edit=${film.id}`}
                  className="rounded-md border border-zinc-700 px-3 py-1 text-[11px] text-zinc-300 transition-colors hover:border-zinc-500 hover:bg-zinc-900"
                >
                  Edit
                </Link>

                <button
                  type="button"
                  disabled={busy === `delete-${film.id}`}
                  onClick={() => remove(film)}
                  className="rounded-md border border-zinc-700 px-3 py-1 text-[11px] text-zinc-400 transition-colors hover:border-red-800 hover:bg-red-950/40 hover:text-red-300 disabled:opacity-40"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
