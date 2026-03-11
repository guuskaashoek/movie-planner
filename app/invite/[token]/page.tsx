import { notFound } from "next/navigation";
import { auth, signIn } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { films, attendees, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { signPosterUrl } from "@/lib/s3";
import { InviteJoinButton } from "./InviteJoinButton";

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function InvitePage({
  params,
}: {
  params: { token: string };
}) {
  const { token } = params;

  // Find film by invite token (public — no auth needed)
  const [film] = await db
    .select()
    .from(films)
    .where(eq(films.inviteToken, token))
    .limit(1);

  if (!film) notFound();

  const session = await auth();
  // @ts-expect-error id is added in auth callback
  const userId: number | undefined = session?.user?.id;

  const filmAttendees = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
    })
    .from(attendees)
    .innerJoin(users, eq(attendees.userId, users.id))
    .where(eq(attendees.filmId, film.id));

  const isAlreadyAttending = userId
    ? filmAttendees.some((a) => a.id === userId)
    : false;

  const posterUrl = await signPosterUrl(film.posterUrl);
  const formats = film.formats ? film.formats.split(",") : [];

  return (
    <div className="mx-auto max-w-lg py-8">
      {/* Header */}
      <div className="mb-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          You're invited to a screening
        </p>
      </div>

      {/* Film card */}
      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-2xl backdrop-blur-sm">
        {/* Poster */}
        {posterUrl && (
          <div className="relative h-64 w-full overflow-hidden bg-zinc-950">
            <img
              src={posterUrl}
              alt={film.title}
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent" />
          </div>
        )}

        <div className="space-y-6 p-6">
          {/* Title + formats */}
          <div>
            <h1 className="text-2xl font-bold text-zinc-50">{film.title}</h1>
            {formats.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {formats.map((fmt) => (
                  <span
                    key={fmt}
                    className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-300"
                  >
                    {fmt}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Date / Time */}
          {(film.date || film.releaseDate) && (
            <div className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3">
              <svg
                className="mt-0.5 h-4 w-4 flex-none text-zinc-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <div>
                {film.date ? (
                  <>
                    <p className="text-sm font-medium text-zinc-200">
                      {formatDate(film.date)}
                    </p>
                    {(film.startTime || film.endTime) && (
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {film.startTime}
                        {film.endTime && ` – ${film.endTime}`}
                      </p>
                    )}
                  </>
                ) : film.releaseDate ? (
                  <p className="text-sm font-medium text-zinc-400">
                    Released {formatDate(film.releaseDate)}
                  </p>
                ) : null}
              </div>
            </div>
          )}

          {/* Description */}
          {film.description && (
            <p className="text-sm leading-relaxed text-zinc-400">
              {film.description}
            </p>
          )}

          {/* Attendees */}
          {filmAttendees.length > 0 && (
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                {filmAttendees.length}{" "}
                {filmAttendees.length === 1 ? "person" : "people"} going
              </p>
              <div className="flex -space-x-2">
                {filmAttendees.slice(0, 8).map((attendee) => (
                  <div
                    key={attendee.id}
                    className="inline-block h-9 w-9 rounded-full ring-2 ring-zinc-900"
                    title={attendee.name || attendee.email}
                  >
                    {attendee.image ? (
                      <img
                        src={attendee.image}
                        alt=""
                        className="h-full w-full rounded-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center rounded-full bg-zinc-700 text-xs font-bold text-white">
                        {(attendee.name?.[0] || attendee.email[0]).toUpperCase()}
                      </div>
                    )}
                  </div>
                ))}
                {filmAttendees.length > 8 && (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 ring-2 ring-zinc-900">
                    <span className="text-[10px] font-medium text-white">
                      +{filmAttendees.length - 8}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="border-t border-zinc-800 pt-2">
            {isAlreadyAttending ? (
              <div className="flex items-center gap-3 rounded-xl border border-green-500/30 bg-green-500/10 px-5 py-4">
                <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-green-500/20 text-green-400">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-green-300">You're already going!</p>
                  <p className="text-xs text-green-400/70">See you at the screening</p>
                </div>
              </div>
            ) : userId ? (
              <InviteJoinButton filmId={film.id} />
            ) : (
              <div className="space-y-3">
                <p className="text-center text-sm text-zinc-400">
                  Sign in to confirm you're going
                </p>
                <form
                  action={async () => {
                    "use server";
                    await signIn("google", {
                      redirectTo: `/invite/${token}`,
                    });
                  }}
                >
                  <button
                    type="submit"
                    className="w-full rounded-xl bg-white px-5 py-3.5 text-sm font-bold text-zinc-950 shadow-lg transition-all hover:bg-zinc-100"
                  >
                    Sign in with Google to Join
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer link */}
      <p className="mt-6 text-center text-xs text-zinc-600">
        Powered by{" "}
        <a href="/board" className="text-zinc-500 hover:text-zinc-400 hover:underline">
          Film Calendar
        </a>
      </p>
    </div>
  );
}
