import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { films } from "@/lib/db/schema";
import { BoardClient } from "./BoardClient";
import { eq } from "drizzle-orm";

const PAGE_SIZE = 20;

export default async function BoardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/");
  }

  const initialFilms = await db
    .select()
    .from(films)
    .where(eq(films.isOnMainBoard, true))
    .orderBy(films.date, films.startTime)
    .limit(PAGE_SIZE);

  const totalOnBoard = await db
    .select({ count: films.id })
    .from(films)
    .where(eq(films.isOnMainBoard, true));

  const hasMore = (totalOnBoard[0]?.count ?? 0) > initialFilms.length;

  const baseUrl =
    process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const icsUrl = `${baseUrl.replace(/\/$/, "")}/api/calendar/feed.ics`;

  return (
    <div className="space-y-8">
      <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950 p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-zinc-50">
              Shared film board
            </h1>
            <p className="text-xs text-zinc-400">
              Chronological timeline of all films sent to the main board.
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
              Calendar subscription (.ics)
            </p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={icsUrl}
                className="w-full rounded-md border border-zinc-800 bg-black px-2 py-1 text-[11px] text-zinc-300"
              />
            </div>
          </div>
        </div>
      </section>

      <BoardClient
        initial={{
          films: initialFilms,
          hasMore,
        }}
      />
    </div>
  );
}

