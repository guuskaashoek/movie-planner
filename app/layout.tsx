import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import Link from "next/link";
import { getSessionActor } from "@/lib/authz";
import "./globals.css";

export const metadata: Metadata = {
  title: "Film Calendar Board",
  description: "Collaborative film calendar with shared board",
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
            <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
              <Link href="/" className="text-sm font-semibold tracking-tight text-zinc-100 hover:text-white">
                🎬 Film Calendar
              </Link>
              <nav className="flex items-center gap-6">
                <Link
                  href="/my-films"
                  className="text-sm text-zinc-400 transition-colors hover:text-zinc-100"
                >
                  My Films
                </Link>
                <Link
                  href="/board"
                  className="text-sm text-zinc-400 transition-colors hover:text-zinc-100"
                >
                  Calendar Board
                </Link>
                {actor && (
                  <Link
                    href="/settings"
                    className="text-sm text-zinc-400 transition-colors hover:text-zinc-100"
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
          <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
