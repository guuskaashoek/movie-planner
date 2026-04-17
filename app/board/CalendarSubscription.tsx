"use client";

import { useState } from "react";

export function CalendarSubscription({ icsUrl }: { icsUrl: string }) {
    const [copied, setCopied] = useState(false);

    const webcalUrl = icsUrl.replace(/^https?:\/\//, "webcal://");

    const handleCopy = async () => {
        await navigator.clipboard.writeText(icsUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex items-center gap-2">
            <a
                href={webcalUrl}
                className="flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:bg-zinc-800 hover:text-zinc-100"
            >
                <svg
                    className="h-3.5 w-3.5 text-blue-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                </svg>
                Agenda abonneren
            </a>
            <button
                onClick={handleCopy}
                title="Kopieer agenda-link"
                className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
            >
                {copied ? "Gekopieerd!" : "Kopieer link"}
            </button>
        </div>
    );
}
