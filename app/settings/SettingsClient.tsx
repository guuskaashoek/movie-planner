"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ApiKey = {
  id: number;
  name: string;
  tokenPrefix: string;
  createdAt: number;
  lastUsedAt: number | null;
};

type Props = {
  account: { name: string | null; email: string; role: string; isAdmin: boolean };
  mcpUrl: string;
  calendar: { name: string; icsUrl: string; boardUrl: string };
  initialKeys: ApiKey[];
  tools: { name: string; title: string; description: string; adminOnly: boolean }[];
};

function formatDate(ms: number | null) {
  if (!ms) return "never";
  return new Date(ms).toLocaleString("nl-NL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          setCopied(false);
        }
      }}
      className="shrink-0 rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:bg-zinc-900 hover:text-white"
    >
      {copied ? "Copied" : label}
    </button>
  );
}

export function SettingsClient({ account, mcpUrl, calendar, initialKeys, tools }: Props) {
  const router = useRouter();
  const [keys, setKeys] = useState<ApiKey[]>(initialKeys);
  const [name, setName] = useState("Grok bot");
  const [creating, setCreating] = useState(false);
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTools, setShowTools] = useState(false);

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { key: ApiKey; token: string };
      setKeys((prev) => [data.key, ...prev]);
      setFreshToken(data.token);
      setName("Grok bot");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the key");
    } finally {
      setCreating(false);
    }
  }

  async function revokeKey(id: number) {
    if (!confirm("Revoke this key? Any bot using it loses access immediately.")) return;
    const res = await fetch(`/api/keys/${id}`, { method: "DELETE" });
    if (res.ok) {
      setKeys((prev) => prev.filter((k) => k.id !== id));
      router.refresh();
    } else {
      setError(await res.text());
    }
  }

  const exampleToken = freshToken ?? "mp_your_key_here";

  const grokSnippet = `{
  "type": "mcp",
  "server_label": "movie-planner",
  "server_url": "${mcpUrl}",
  "authorization": "${exampleToken}"
}`;

  const clientSnippet = `{
  "mcpServers": {
    "movie-planner": {
      "type": "http",
      "url": "${mcpUrl}",
      "headers": {
        "Authorization": "Bearer ${exampleToken}"
      }
    }
  }
}`;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Settings</h1>
        <p className="text-sm text-zinc-400">
          Connect an AI assistant to your film board and manage its access.
        </p>
      </header>

      {/* Account ------------------------------------------------------- */}
      <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Account</p>
            <p className="mt-1 text-sm font-medium text-zinc-100">
              {account.name ?? account.email}
            </p>
            <p className="text-xs text-zinc-500">{account.email}</p>
          </div>
          <span
            className={
              account.isAdmin
                ? "rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300"
                : "rounded-md border border-zinc-700 px-3 py-1 text-xs font-medium text-zinc-400"
            }
          >
            {account.isAdmin ? "Admin" : "Member"}
          </span>
        </div>
        {account.isAdmin && (
          <p className="mt-4 border-t border-zinc-800 pt-4 text-xs leading-relaxed text-zinc-400">
            Admin rights apply to the website <span className="text-zinc-200">and</span> to any API
            key you create here: an assistant using your key can edit, move and delete every
            user&apos;s films, manage polls, comments and ratings, and act on behalf of other
            members.
          </p>
        )}
      </section>

      {/* MCP connection ------------------------------------------------ */}
      <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-zinc-100">MCP server</h2>
          <p className="text-xs text-zinc-400">
            One endpoint that lets an AI assistant read and manage the whole board.
          </p>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <input
            readOnly
            value={mcpUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 rounded-md border border-zinc-800 bg-black px-3 py-2 font-mono text-xs text-zinc-300"
          />
          <CopyButton value={mcpUrl} />
        </div>

        <dl className="mt-4 grid gap-3 border-t border-zinc-800 pt-4 text-xs sm:grid-cols-3">
          <div>
            <dt className="text-zinc-500">Transport</dt>
            <dd className="mt-0.5 font-mono text-zinc-300">Streamable HTTP</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Auth header</dt>
            <dd className="mt-0.5 font-mono text-zinc-300">Authorization: Bearer …</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Tools available to you</dt>
            <dd className="mt-0.5 font-mono text-zinc-300">{tools.length}</dd>
          </div>
        </dl>

        <button
          type="button"
          onClick={() => setShowTools((v) => !v)}
          className="mt-4 text-xs font-medium text-zinc-400 underline-offset-4 hover:text-zinc-200 hover:underline"
        >
          {showTools ? "Hide" : "Show"} what the assistant can do
        </button>

        {showTools && (
          <ul className="mt-3 space-y-2 border-t border-zinc-800 pt-3">
            {tools.map((tool) => (
              <li key={tool.name} className="flex gap-3 text-xs">
                <code className="w-44 shrink-0 font-mono text-zinc-300">{tool.name}</code>
                <span className="text-zinc-500">
                  {tool.title}
                  {tool.adminOnly && (
                    <span className="ml-2 rounded border border-amber-500/40 px-1 py-0.5 text-[10px] text-amber-300">
                      admin
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Keys ---------------------------------------------------------- */}
      <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-zinc-100">API keys</h2>
          <p className="text-xs text-zinc-400">
            A key acts as you. Anything you can do on the board, a bot holding this key can do too.
          </p>
        </div>

        <form onSubmit={createKey} className="mt-4 flex flex-wrap items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="What is this key for?"
            maxLength={60}
            className="min-w-0 flex-1 rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
          />
          <button
            type="submit"
            disabled={creating}
            className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create key"}
          </button>
        </form>

        {error && (
          <p className="mt-3 rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-xs text-red-300">
            {error}
          </p>
        )}

        {freshToken && (
          <div className="mt-4 rounded-md border border-emerald-800 bg-emerald-950/30 p-4">
            <p className="text-xs font-medium text-emerald-300">
              Copy this key now — it is shown only once.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 overflow-x-auto rounded border border-emerald-900 bg-black px-3 py-2 font-mono text-xs text-emerald-200">
                {freshToken}
              </code>
              <CopyButton value={freshToken} />
            </div>
          </div>
        )}

        <div className="mt-5 border-t border-zinc-800 pt-4">
          {keys.length === 0 ? (
            <p className="text-xs text-zinc-500">No keys yet.</p>
          ) : (
            <ul className="space-y-2">
              {keys.map((key) => (
                <li
                  key={key.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-zinc-800 bg-black px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-zinc-200">{key.name}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-zinc-500">
                      {key.tokenPrefix}…&nbsp;·&nbsp;created {formatDate(key.createdAt)}
                      &nbsp;·&nbsp;last used {formatDate(key.lastUsedAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => revokeKey(key.id)}
                    className="shrink-0 rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-red-800 hover:bg-red-950/40 hover:text-red-300"
                  >
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Setup --------------------------------------------------------- */}
      <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
        <h2 className="text-sm font-semibold text-zinc-100">Connect your bot</h2>

        <div className="mt-4 space-y-5">
          <div>
            <p className="text-xs font-medium text-zinc-300">
              Grok (xAI Agent Tools / Responses API)
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Add the server to the <code className="font-mono text-zinc-400">tools</code> array of
              your request. The key works with or without a{" "}
              <code className="font-mono text-zinc-400">Bearer</code> prefix, so either form is
              fine.
            </p>
            <pre className="mt-2 overflow-x-auto rounded-md border border-zinc-800 bg-black p-3 font-mono text-[11px] leading-relaxed text-zinc-300">
              {grokSnippet}
            </pre>
            <div className="mt-2">
              <CopyButton value={grokSnippet} label="Copy Grok config" />
            </div>
          </div>

          <div className="border-t border-zinc-800 pt-5">
            <p className="text-xs font-medium text-zinc-300">
              Claude Code, Cursor and other MCP clients
            </p>
            <pre className="mt-2 overflow-x-auto rounded-md border border-zinc-800 bg-black p-3 font-mono text-[11px] leading-relaxed text-zinc-300">
              {clientSnippet}
            </pre>
            <div className="mt-2">
              <CopyButton value={clientSnippet} label="Copy MCP config" />
            </div>
          </div>
        </div>
      </section>

      {/* Calendar ------------------------------------------------------ */}
      <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
        <h2 className="text-sm font-semibold text-zinc-100">Calendar subscription</h2>
        <p className="mt-1 text-xs text-zinc-400">
          Add this link to Google or Apple Calendar to follow the films you joined.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <input
            readOnly
            value={calendar.icsUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 rounded-md border border-zinc-800 bg-black px-3 py-2 font-mono text-xs text-zinc-300"
          />
          <CopyButton value={calendar.icsUrl} />
        </div>
      </section>
    </div>
  );
}
