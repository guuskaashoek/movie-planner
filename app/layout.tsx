import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Film Calendar Board",
  description: "Collaborative film calendar with shared board",
  icons: {
    icon: "/icon.svg",
  },
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
              <Link href="/" className="flex items-center gap-2.5 text-sm font-semibold tracking-tight text-zinc-100 hover:text-white">
                <svg viewBox="0 0 80 56" fill="none" xmlns="http://www.w3.org/2000/svg" width="28" height="20" aria-hidden="true">
                  <rect x="1" y="1" width="78" height="54" rx="8" fill="white"/>
                  <rect x="1" y="1" width="18" height="54" rx="8" fill="#a1a1aa"/>
                  <rect x="11" y="1" width="8" height="54" fill="#a1a1aa"/>
                  <rect x="61" y="1" width="18" height="54" rx="8" fill="#a1a1aa"/>
                  <rect x="61" y="1" width="8" height="54" fill="#a1a1aa"/>
                  <rect x="3" y="10" width="14" height="9" rx="2.5" fill="white"/>
                  <rect x="3" y="24" width="14" height="9" rx="2.5" fill="white"/>
                  <rect x="3" y="37" width="14" height="9" rx="2.5" fill="white"/>
                  <rect x="63" y="10" width="14" height="9" rx="2.5" fill="white"/>
                  <rect x="63" y="24" width="14" height="9" rx="2.5" fill="white"/>
                  <rect x="63" y="37" width="14" height="9" rx="2.5" fill="white"/>
                </svg>
                Film Calendar
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
