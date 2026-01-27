import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { films } from "@/lib/db/schema";
import { BoardClient } from "./BoardClient";
import { CalendarSubscription } from "./CalendarSubscription";
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
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Calendar Subscription Section */}
      <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
        <div className="space-y-4">
          <div>
            <h1 className="text-xl font-semibold text-zinc-50">
              Calendar Board
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              All films shared to the board, synced to your calendar
            </p>
          </div>

          <CalendarSubscription icsUrl={icsUrl} />
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

