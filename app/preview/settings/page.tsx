import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarSubscription } from "@/app/board/CalendarSubscription";

export default function PreviewSettings() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <div className="page-frame space-y-6">
      <Link href="/preview" className="inline-flex min-h-11 items-center text-sm text-zinc-400">← Back to films</Link>
      <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
      <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950 p-5">
        <div>
          <h2 className="text-lg font-semibold">Connect your calendar</h2>
          <p className="mt-1 text-sm text-zinc-400">Keep the films you’re going to in your own calendar.</p>
        </div>
        <CalendarSubscription icsUrl="https://example.com/movie-planner/feed.ics?userId=demo" />
      </section>
      <p className="text-xs leading-relaxed text-zinc-500">
        Design preview: these buttons use a sample calendar URL. In Settings on your real account they use your personal calendar feed.
      </p>
    </div>
  );
}
