<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Movie Planner — agent guide

Private film planner for a friend group (live at https://movie.guuss.com). Members add films to a shared board, vote on screening times in polls, mark themselves *going* / *interested*, store cinema tickets, and get screenings in their own calendar through a personal `.ics` feed. An MCP server lets AI assistants manage the board under the same rules as the website.

`README.md` is the human-facing overview. This file covers what you need to change code safely.

## Stack

- **Next.js 16** App Router, React 19, server components. TypeScript strict. Path alias `@/*` → repo root.
- **SQLite** via `better-sqlite3` + **Drizzle ORM** (`lib/db/schema.ts`, migrations in `drizzle/`). The DB file is `./db.sqlite` (gitignored).
- **Auth.js / NextAuth v5** (beta) with Google sign-in and JWT sessions (`lib/auth.ts`).
- **Wasabi** (S3-compatible) via AWS SDK v3 for posters and ticket images (`lib/s3.ts`, `lib/images.ts`). Objects are private and served through signed URLs.
- **Tailwind CSS v4** (PostCSS plugin), plus a few hand-written CSS files (`app/board/discovery.css`, `app/tickets/tickets.css`).
- `zod`, `date-fns`, `ical-generator`, `jsqr` + `qrcode` (ticket QR decode/redraw), `sharp`, `geist` font.
- Package manager: **npm** (`package-lock.json`). Don't use bun, yarn or pnpm, and don't commit their lockfiles.

## Commands

| Command | Use |
| --- | --- |
| `npm run dev` | Dev server on http://localhost:3000 |
| `npm run lint` | ESLint. Must pass with **zero errors and zero warnings** |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | `node:test` suites in `tests/*.test.mjs` (needs Node 22.6+ for `--experimental-strip-types`) |
| `npm run build` | Production build |
| `npm run db:generate` | Create a migration from `lib/db/schema.ts` |
| `npm run db:push` | Push the schema straight to the local `db.sqlite` (local dev only) |
| `npm run db:migrate` | Apply migrations (production does this on start) |
| `npm run dev:fresh` | Generate, **force**-push the schema, start dev. Local only, can drop data |

Before calling a change done, run `npm run lint && npm run typecheck && npm test`. Also run `npm run build` for anything that touches routes, config or the server/client boundary.

For UI work without credentials, open `/preview` (board), `/preview/tickets` and `/preview/settings`. They render sample data from `app/preview/fixtures.ts` and return 404 in production.

## Layout

```
app/                     App Router pages + API routes
  api/                   Route handlers (see "API routes" below)
  board/                 Main board (landing page after sign-in), spotlight, calendar link
  film/[id]/             Film detail: poll, attendance, comments, rating, tickets
  my-films/              Personal list; send films to the board
  tickets/               Ticket wallet
  settings/              Profile + MCP API keys
  admin/                 Roles, film transfer, stats (admin only)
  invite/[token]/        Invite links with Open Graph previews
  preview/               Credential-free design preview (dev only)
  components/            Shared client components + useLiveUpdates hook
lib/
  authz.ts               Actor resolution (session or API key), roles, permission helpers
  films.ts               All domain mutations and permission checks; ServiceError
  mcp/tools.ts           MCP tool definitions (thin wrappers around lib/films.ts)
  db/schema.ts           Drizzle schema (source of truth)
  db/client.ts           SQLite connection + legacy idempotent ALTER/CREATE statements
  images.ts              SSRF-safe poster import, magic-byte sniffing, upload storage
  s3.ts                  S3 client, signed URLs
  live.ts                In-process event emitter for live updates
  poll.ts, comments.ts   Read helpers
  board-discovery.ts     Board ranking/spotlight rules (pure, tested)
  ticket-access.ts       Who may see tickets, ticket window, wallet grouping (pure, tested)
  ticket-label.ts        Parses "Row 8 · Seats 12-14" and Dutch "Rij 8 stoel 12" (pure, tested)
  ticket-qr.ts           Decode a QR from a photo, render a clean SVG (tested)
drizzle/                 SQL migrations + meta snapshots (generated)
scripts/                 start-prod.sh (backup → migrate → start), dev-fresh.sh
tests/                   node:test suites that import lib/*.ts directly
```

## Architecture rules

### Authorization lives in `lib/authz.ts` + `lib/films.ts`

- Every action is performed by an `Actor` (`{ userId, email, name, role, isAdmin, via }`). Resolve it with `getSessionActor()` (web), `getApiKeyActor(req)` (MCP) or `getActor(req?)`.
- **All mutations go through functions in `lib/films.ts`.** They take the actor as their first argument and enforce permissions themselves. Don't write permission checks or DB writes for films, polls, attendance, comments, ratings, tickets or roles directly in a route or page. Add or extend a function in `lib/films.ts`, so the website and the MCP server share one rule. (Some server pages still read from the DB directly; that's fine for reads.)
- Errors meant for the caller are thrown as `new ServiceError(message, status)`. Routes turn them into a response; any other error is logged and becomes a 500.
- Permission matrix:

  | | member | admin |
  | --- | --- | --- |
  | Create films | yes | yes |
  | Edit/delete films, edit polls | own films | all |
  | Delete comments | own, or on own film | any |
  | Rate a film | after attending a finished screening | any time |
  | Act as another user (`asUser` in MCP) | no | yes |
  | Manage roles, transfer films | no | yes |

- `users.role` is `"user" | "admin"`. Emails in `ADMIN_EMAILS` are always admin (`resolveRole`). Keep that bootstrap path working so nobody can lock themselves out.
- **Registration is closed.** The Google sign-in callback only accepts emails that already exist in `users`. Don't add self-signup.

### API routes

Follow the existing pattern (e.g. `app/api/films/[id]/attend/route.ts`):

```ts
type RouteParams = { params: Promise<{ id: string }> }; // params is a Promise: await it

export async function POST(req: NextRequest, { params }: RouteParams) {
  const actor = await getSessionActor();
  if (!actor) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  const filmId = Number(id);
  if (!Number.isInteger(filmId)) return new NextResponse("Invalid film ID", { status: 400 });
  try {
    return NextResponse.json(await someServiceFn(actor, filmId /* , ... */));
  } catch (err) {
    if (err instanceof ServiceError) return new NextResponse(err.message, { status: err.status });
    console.error("[route/name]", err);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
```

Admin endpoints live under `app/api/admin/`, but the admin check itself still happens in `lib/films.ts`.

### MCP server

- `POST /api/mcp` (`app/api/mcp/route.ts`): stateless Streamable HTTP, JSON-RPC 2.0. Auth is `Authorization: Bearer mp_...` (or `X-Api-Key`).
- Tools are `ToolDefinition`s in `lib/mcp/tools.ts` that call `lib/films.ts`. When you add a user-facing capability, check whether a matching tool should be added or updated.
- Keep tool input schemas **flat, plain JSON Schema** (no `$ref`, `oneOf` and so on). Grok's parser rejects anything fancier.
- Admin-only tools must be hidden by `toolsFor(actor)` **and** refused server-side.
- API keys are shown once; only the SHA-256 hash is stored and it is compared in constant time. Never log or store raw tokens.

### Database

- `lib/db/schema.ts` is the source of truth. For a schema change: edit the schema, run `npm run db:generate`, and commit the new SQL file **together with** the `drizzle/meta` snapshot and journal changes. Production runs `drizzle-kit migrate` on container start (`scripts/start-prod.sh`, which backs up `db.sqlite` first).
- The migration history starts from the existing production DB, so a fresh local DB is created with `db:push`, not `db:migrate`.
- `lib/db/client.ts` still runs legacy idempotent `ALTER TABLE` / `CREATE TABLE IF NOT EXISTS` statements on import. Don't add new ones there (use Drizzle migrations), and don't remove the existing ones without checking production.
- `foreign_keys = ON` is set, so `ON DELETE CASCADE` works. Rely on it rather than cleaning up by hand.
- Dates are stored as `YYYY-MM-DD` strings, times as `HH:mm` (24h) strings, and `createdAt` columns as epoch milliseconds. Validate input with the helpers in `lib/films.ts`.
- **Timezone:** everything user-facing runs on `Europe/Amsterdam` (board ranking, ticket window, calendar feed). Don't use the server's local time for "is this screening today / over" logic; reuse `amsterdamClock` and the existing helpers.

### Live updates

After a mutation, call `publishLiveEvent({ topic, filmId })` from `lib/live.ts` (the existing `lib/films.ts` functions already do). `GET /api/live` streams the events as Server-Sent Events; `app/components/useLiveUpdates.ts` reconnects when the stream stalls and refreshes the page data. The emitter is in-process, so this assumes a single server instance. The SSE stream must remove its listener when the client disconnects (see `app/api/live/route.ts`).

### Images, posters and tickets (security-sensitive)

- Importing a poster or backdrop from a URL goes through `importPosterFromUrl` in `lib/images.ts`: http(s) only, private/loopback/link-local addresses refused, every redirect hop re-checked, 10 MB cap, magic-byte check, then re-hosted in our bucket. **Never fetch a user-supplied URL any other way.**
- Uploads are checked with `sniffImageType` / `ALLOWED_UPLOAD_TYPES`. Don't trust the client's content type.
- Ticket images are never public. Opening one re-checks access (`mayViewAdmissionTickets`: going, or voted for the winning poll option) and then redirects to a short-lived signed URL. Keep both steps when you touch ticket routes.
- Show stored images through `signPosterUrl`. `next.config.ts` only allows remote images from `lh3.googleusercontent.com` and `*.wasabisys.com`.

### Frontend

- Server components fetch data. Use `"use client"` components only for interactivity; they are named `*Client.tsx` (e.g. `BoardClient.tsx`).
- Styling: Tailwind utilities, **dark theme only, no gradients**.
- Mobile-first: the group mostly uses the app on phones and as an installed PWA (`app/manifest.ts`, `IosInstallHint`). Check layouts at phone width.
- UI copy is in English (ticket label parsing also accepts Dutch input).
- If a page has a `/preview` counterpart, update `app/preview/fixtures.ts` when you change what it shows, so design work keeps working without credentials.

## Environment

The template is `.env.example`; local values live in `.env.local` (gitignored). Never commit, print or copy secrets from it.

- Required: `NEXTAUTH_URL`, `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `WASABI_ACCESS_KEY`, `WASABI_SECRET_KEY`, `WASABI_BUCKET_NAME`.
- Optional: `WASABI_REGION` (default `eu-central-1`), `WASABI_ENDPOINT`, `WASABI_PUBLIC_BASE`, `ADMIN_EMAILS`, `GRAPE_REMINDER_EMAILS`.

When you add an env var, add it to `.env.example` with a comment and to the table in `README.md`. Don't hardcode personal emails or other private data in source; read them from env (as `GRAPE_REMINDER_EMAILS` does).

Local sign-in needs your email in `users` first:

```bash
sqlite3 db.sqlite "INSERT INTO users (email, google_id) VALUES ('you@example.com', 'pending');"
```

## Tests

- `node:test` + `node:assert/strict`, files named `tests/*.test.mjs`, importing TypeScript directly (`../lib/foo.ts`).
- Only pure modules are tested (no DB, no network). Put new testable logic in pure functions in `lib/` and add a test, especially for permissions, dates/timezones, board ranking and tickets.
- Because the tests run with `--experimental-strip-types`, modules they load must use erasable TypeScript only (no `enum`, no parameter properties) and relative imports instead of `@/` paths.

## Deployment

- A push to `main` triggers `.github/workflows/deploy.yml`, which builds a `linux/arm64` image and pushes `ghcr.io/guuskaashoek/jet-project-movie-planner:latest`. Watchtower on the server pulls it and restarts the container. **Merging to `main` deploys to production.**
- The `Dockerfile` (`node:20-alpine`) keeps devDependencies because `drizzle-kit migrate` runs on start. Runtime secrets come from the server environment, never from the image.
- Migrations run against the live DB on start, so avoid destructive changes (dropping or renaming columns that hold data) unless there is a plan for the data.

## Git workflow

- Don't commit directly to `main`. Work on a branch (`feat/…`, `fix/…`, `chore/…`, `docs/…`) and open a PR.
- Conventional-style commit messages: `feat: …`, `fix(scope): …`, `chore: …`, `docs: …`. Keep commits small and focused.
- In the PR description, say what changed and why, and how it was tested (steps, or screenshots for UI).
- Bump `version` in `package.json` for notable releases.
- Keep this file up to date when you change the architecture, commands, env vars or conventions. `CLAUDE.md` only imports it (`@AGENTS.md`).
