import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import Link from "next/link";
import { getSessionActor } from "@/lib/authz";
import "./globals.css";

export const metadata: Metadata = {
  title: "Movie Planner",
  description: "Plan your next movie night together.",
  icons: { icon: "/icon.svg", apple: "/apple-icon.png" },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Signed-out visitors just see the marketing page, so a missing actor is fine.
  const actor = await getSessionActor().catch(() => null);
  return (
    <html lang="en" className="dark">
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} antialiased bg-black text-zinc-100`}
      >
        <div className="min-h-screen bg-black text-zinc-100">
          <header className="border-b border-zinc-800">
            <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
              <Link href="/" aria-label="Movie Planner home" className="flex min-h-11 items-center gap-2.5 text-sm font-semibold tracking-tight text-zinc-100 hover:text-white">
                {/* A vector mark stays crisp even at favicon size. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icon.svg" width="36" height="36" alt="" />
                <span>Movie Planner</span>
              </Link>
              <nav className="flex w-full items-center gap-1 overflow-x-auto sm:w-auto sm:gap-3" aria-label="Main navigation">
                <Link
                  href="/board"
                  className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 text-sm text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
                >
                  Board
                </Link>
                <Link
                  href="/my-films"
                  className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 text-sm text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
                >
                  My Films
                </Link>
                {actor && (
                  <Link
                    href="/settings"
                    className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 text-sm text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
                  >
                    Settings
                  </Link>
                )}
                {actor?.isAdmin && (
                  <Link
                    href="/admin"
                    className="rounded-md border border-amber-500/50 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-500/20"
                  >
                    Admin
                  </Link>
                )}
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
