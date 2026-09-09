"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export function SiteHeader({ signedIn, isAdmin }: { signedIn: boolean; isAdmin: boolean }) {
  const path = usePathname();
  const params = useSearchParams();
  const preview = path.startsWith("/preview");
  const overlay = path === "/board" || (path === "/preview" && !params.get("film"));
  const links = [
    { href: preview ? "/preview" : "/board", label: "Films", icon: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M7 4v16m10-16v16M3 9h4m10 0h4M3 15h4m10 0h4" /></> },
    { href: preview ? "/preview/tickets" : "/tickets", label: "Tickets", icon: <><path d="M4 5h16v5a2 2 0 0 0 0 4v5H4v-5a2 2 0 0 0 0-4Z" /><path d="M15 5v3m0 8v3" /></> },
    { href: "/my-films", label: "My films", icon: <><path d="M6 4h12v17l-6-4-6 4Z" /></> },
    ...((signedIn || preview) ? [{ href: preview ? "/preview/settings" : "/settings", label: "Settings", icon: <><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="3" fill="currentColor" /><circle cx="15" cy="17" r="3" fill="currentColor" /></> }] : []),
  ];
  return (
    <>
      <header className={`site-header ${overlay ? "is-overlay" : ""}`}>
        <div className="site-header-inner">
          <Link href={preview ? "/preview" : "/"} className="site-brand" aria-label="Movie Planner home">
            <img src="/icon.svg" width="30" height="30" alt="" />
            <span>
              movie<span className="font-normal text-zinc-400">planner</span>
            </span>
            {preview && <span className="preview-flag">preview</span>}
          </Link>
          <nav className="desktop-nav" aria-label="Main navigation">
            {links.map((link) => (
              <Link key={link.href} href={link.href} aria-current={path === link.href ? "page" : undefined}>
                {link.label}
              </Link>
            ))}
            {isAdmin && <Link href="/admin">Admin</Link>}
          </nav>
          <Link href="/my-films" className="mobile-add" aria-label="Add a film">
            <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" fill="none">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </Link>
        </div>
      </header>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {links.map((link) => (
          <Link key={link.href} href={link.href} aria-current={path === link.href ? "page" : undefined}>
            <svg aria-hidden="true" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              {link.icon}
            </svg>
            <span>{link.label}</span>
          </Link>
        ))}
        {isAdmin && (
          <Link href="/admin" aria-current={path === "/admin" ? "page" : undefined}>
            <span className="text-lg">⚙</span>
            <span>Admin</span>
          </Link>
        )}
      </nav>
    </>
  );
}
