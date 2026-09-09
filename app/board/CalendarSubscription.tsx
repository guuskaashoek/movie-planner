"use client";

import { useState } from "react";

export function CalendarSubscription({ icsUrl }: { icsUrl: string }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const webcalUrl = icsUrl.replace(/^https?:\/\//, "webcal://");
  const googleUrl = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl)}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(icsUrl);
      setCopied(true);
      setCopyError(false);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError(true);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <a href={webcalUrl} className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-white">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="4" y="5" width="16" height="16" rx="3" /><path d="M8 3v4m8-4v4M4 11h16m-12 4h3m2 0h3" /></svg>
          Connect Apple Calendar
        </a>
        <a href={googleUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-semibold text-zinc-100 transition-colors hover:bg-zinc-800">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="4" y="5" width="16" height="16" rx="3" /><path d="M8 3v4m8-4v4M4 11h16" /><text x="7" y="18" fontSize="7" fill="currentColor" stroke="none">31</text></svg>
          Connect Google Calendar
        </a>
      </div>
      <p className="text-xs leading-relaxed text-zinc-500">Confirm the subscription in your calendar. Google opens in your browser.</p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={handleCopy} className="inline-flex min-h-11 items-center text-xs font-medium text-zinc-400 underline decoration-zinc-700 underline-offset-4 hover:text-white">{copied ? "Link copied" : "Copy link for another calendar"}</button>
        <span role="status" className="text-xs text-zinc-500">{copyError ? "Copy the URL below instead." : copied ? "Ready to paste." : ""}</span>
      </div>
      <details open={copyError || undefined} className="text-xs text-zinc-500">
        <summary className="w-fit cursor-pointer py-2">Calendar URL</summary>
        <input aria-label="Calendar subscription URL" readOnly value={icsUrl} onFocus={e => e.currentTarget.select()} className="mt-2 min-h-11 w-full rounded-lg border border-zinc-800 bg-black px-3 font-mono text-xs text-zinc-400" />
      </details>
    </div>
  );
}
