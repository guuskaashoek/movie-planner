import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";

export default async function Home() {
  const session = await auth();

  if (session?.user) {
    redirect("/board");
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl space-y-8 rounded-xl border border-zinc-800 bg-zinc-950 p-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
            Movie Planner
          </h1>
          <p className="text-sm text-zinc-400">
            Plan screenings, save films and keep the whole group together.
          </p>
          <p className="pt-2 text-xs text-zinc-500">Sign-in is currently limited to existing members.</p>
        </div>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/board" });
          }}
        >
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white/90"
          >
            Sign in as an existing member
          </button>
        </form>
      </div>
    </div>
  );
}
