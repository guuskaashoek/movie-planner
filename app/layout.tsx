import type { Metadata } from "next";
import { Suspense } from "react";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Big_Shoulders } from "next/font/google";
import { SiteHeader } from "@/app/components/SiteHeader";
import { getSessionActor } from "@/lib/authz";
import "./globals.css";

const display = Big_Shoulders({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

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
        className={`${GeistSans.variable} ${GeistMono.variable} ${display.variable} antialiased bg-black text-zinc-100`}
      >
        <div className="min-h-screen bg-black text-zinc-100">
          <Suspense>
            <SiteHeader signedIn={!!actor} isAdmin={actor?.isAdmin ?? false} />
          </Suspense>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
