import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Film Calendar Board",
  description: "Collaborative film calendar with shared board",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
