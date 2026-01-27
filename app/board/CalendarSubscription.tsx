"use client";

export function CalendarSubscription({ icsUrl }: { icsUrl: string }) {
    const handleCopy = () => {
        navigator.clipboard.writeText(icsUrl);
        // Optional: show a toast notification
    };

    return (
        <div className="rounded-lg border border-zinc-800 bg-black p-4">
            <div className="flex items-start gap-3">
                <div className="rounded-lg bg-blue-500/10 p-2">
                    <svg
                        className="h-5 w-5 text-blue-400"
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
                </div>
                <div className="flex-1 space-y-3">
                    <div>
                        <h3 className="text-sm font-medium text-zinc-100">
                            Add to Your Calendar
                        </h3>
                        <p className="mt-1 text-xs text-zinc-400">
                            Subscribe to this calendar feed to automatically sync all board
                            films to your personal calendar app (Google Calendar, Apple
                            Calendar, Outlook, etc.)
                        </p>
                    </div>
                    <div className="space-y-2">
                        <label className="block text-xs font-medium text-zinc-300">
                            Your Personal Calendar Link
                        </label>
                        <div className="flex gap-2">
                            <input
                                readOnly
                                value={icsUrl}
                                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 outline-none"
                                onClick={(e) => e.currentTarget.select()}
                            />
                            <button
                                onClick={handleCopy}
                                className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:bg-zinc-800"
                            >
                                Copy
                            </button>
                        </div>
                        <p className="text-xs text-zinc-500">
                            Copy this link and add it as a calendar subscription in your
                            calendar app. Films marked &quot;On shared board&quot; will appear in
                            your calendar.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
