import { auth, signOut } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { films } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { MyFilmsClient } from "./MyFilmsClient";

export default async function MyFilmsPage() {
  const session = await auth();

  // @ts-expect-error id is added in auth callback
  const userId: number | undefined = session?.user?.id;

  if (!userId) {
    return null;
  }

  const userFilms = await db
    .select()
    .from(films)
    .where(eq(films.userId, userId))
    .orderBy(films.date, films.startTime);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-zinc-400">Signed in as</p>
          <p className="text-sm font-medium text-zinc-100">
            {session?.user?.name ?? session?.user?.email}
          </p>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut();
          }}
        >
          <button
            type="submit"
            className="rounded-md border border-zinc-700 px-3 py-1 text-xs text-zinc-300"
          >
            Sign out
          </button>
        </form>
      </div>
      <MyFilmsClient initial={{ films: userFilms }} />
    </div>
  );
}

