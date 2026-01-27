import { auth, signOut } from "@/lib/auth";
import { MyFilmsClient } from "./MyFilmsClient";

export default async function MyFilmsPage() {
  const session = await auth();

  // @ts-expect-error id is added in auth callback
  const userId: number | undefined = session?.user?.id;

  if (!userId) {
    return null;
  }

  // Fetch all films from API (server-side)
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/films`, {
    headers: {
      cookie: `authjs.session-token=${session?.user?.id}`,
    },
    cache: "no-store",
  });

  const data = await res.json();
  const allFilms = data.films || [];

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
            className="rounded-md border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:border-zinc-600 hover:bg-zinc-900"
          >
            Sign out
          </button>
        </form>
      </div>
      <MyFilmsClient initial={{ films: allFilms, currentUserId: userId }} />
    </div>
  );
}

