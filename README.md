# Movie Planner

**Live:** https://movie.guuss.com (sign-in is limited to existing members)

Movie Planner is a private film planner for my friend group. Instead of losing plans in a group chat, everyone adds the films they want to see to a shared board, votes on a screening time, says whether they are going, and keeps their cinema tickets in one place. Screenings show up in everyone's own calendar automatically.

It started as a small side project in January 2026 and has grown feature by feature since, driven by how the group actually uses it.

## Features

- **Shared board** with a spotlight hero for the next big screening, plus list and grid views on mobile.
- **Personal film list** (`/my-films`) to collect films and send them to the board when they are ready.
- **Screening polls**: propose several dates and times, members vote, the winning slot becomes the screening.
- **Attendance**: mark yourself as *going* or *interested*; avatars show who is coming.
- **Ticket wallet** (`/tickets`): ticket photos are added per screening, the QR code is decoded and redrawn as a clean, scannable code, and only members who are going can open them.
- **Calendar feed**: every member gets a personal `.ics` link that syncs the screenings they attend or voted for to Google Calendar, Apple Calendar and others.
- **Comments and ratings**: discuss a film and rate it after the screening.
- **Invite links** with Open Graph previews for WhatsApp and other apps.
- **Live updates**: changes by other members appear without a reload.
- **Installable PWA**, including an "Add to Home Screen" hint on iOS Safari.
- **Admin page** (`/admin`) to manage roles, transfer films and see totals.
- **MCP server** so AI assistants (Grok, Claude, Cursor) can manage the board through the same rules as the website.

## Stack

| Area | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, React 19, server components) |
| Language | TypeScript (strict) |
| Database | SQLite via better-sqlite3, Drizzle ORM and Drizzle migrations |
| Auth | Auth.js / NextAuth v5 with Google sign-in, JWT sessions |
| Storage | Wasabi (S3-compatible) through the AWS SDK, private objects with signed URLs |
| Styling | Tailwind CSS v4, dark theme |
| Other | `ical-generator` for calendar feeds, `jsqr` and `qrcode` for tickets, `sharp` for images, `zod` for validation |
| Tooling | ESLint (next config), `tsc`, Node's built-in test runner |

## Architecture notes

- **Authorization lives in one place.** `lib/authz.ts` resolves who is acting (session or API key) and their role; `lib/films.ts` contains the actual operations and permission checks. API routes and the MCP server both call into `lib/films.ts`, so the website and the AI tools enforce exactly the same rules.
- **Roles.** `users.role` is `user` or `admin`. Emails in `ADMIN_EMAILS` are always admin, so the first admin can bootstrap the app and nobody can lock themselves out.

  | | member | admin |
  | --- | --- | --- |
  | Create films | yes | yes |
  | Edit or delete films | own only | every film |
  | Edit polls | own films | every film |
  | Delete comments | own, or on own film | any comment |
  | Rate a film | after attending a finished screening | any time |
  | Act on behalf of another member | no | yes |
  | Manage roles, transfer films | no | yes |

- **Closed registration.** The Google sign-in callback only accepts emails that already exist in the `users` table.
- **MCP server** at `POST /api/mcp` (Streamable HTTP, stateless JSON-RPC). Members create personal API keys in `/settings`. A key is shown once and only its SHA-256 hash is stored. A key inherits its owner's role; admin-only tools are hidden from member keys and refused server-side as well.
- **SSRF-safe poster import.** Posters and backdrops can be imported from any public URL. The server only allows http(s), refuses private, loopback and link-local addresses, re-checks every redirect hop, caps downloads at 10 MB and verifies the file's magic bytes before re-hosting it in our own bucket. Direct uploads are checked the same way.
- **Signed ticket links.** Ticket images are never public. Opening a ticket re-checks that you are going, then redirects to a short-lived signed storage URL.
- **Live updates.** Mutations publish an event on an in-process emitter; `GET /api/live` streams them as Server-Sent Events. The client hook (`app/components/useLiveUpdates.ts`) reconnects when the stream stalls and refreshes the page data.
- **Design preview.** `/preview` renders the board, tickets and settings with sample data and local artwork, without signing in. It returns 404 in production.

### Project layout

```
app/            Pages (App Router) and API routes under app/api
  components/   Shared client components and hooks
lib/            Domain logic: authz, films, polls, images, storage, MCP tools
  db/           Drizzle schema and database client
drizzle/        SQL migrations and snapshots
scripts/        Start scripts for production and local resets
tests/          node:test suites for board ranking and ticket logic
```

## Built with AI tools

I build this project in an AI-native way. Many features started as tasks for Claude Code or Codex (you can see the `claude/*` and `codex/*` branches in the merged pull requests). I own the product and design decisions, write the briefs, and review and test every change before it is merged, reshaping or fixing what does not fit. The goal is to spend my time on what the app should feel like and whether the code is right, not on typing boilerplate.

## Local setup

Requirements: Node.js 22 (the tests use `--experimental-strip-types`, Node 22.6+), npm, a Google OAuth client and a Wasabi (or other S3-compatible) bucket.

```bash
npm ci
cp .env.example .env.local   # then fill in the values
npm run db:push              # create the local SQLite schema (db.sqlite)
npm run dev                  # http://localhost:3000
```

The migration history in `drizzle/` starts from the existing production database, so a brand-new local database is created with `db:push` from `lib/db/schema.ts`. Production applies the migrations with `drizzle-kit migrate` on start (see Deployment).

Because registration is closed, add your own email to the `users` table before signing in, for example:

```bash
sqlite3 db.sqlite "INSERT INTO users (email, google_id) VALUES ('you@example.com', 'pending');"
```

The Google ID is filled in on your first sign-in. List the same email in `ADMIN_EMAILS` to become admin. For UI work without any credentials, open `http://localhost:3000/preview`.

### Environment variables

See `.env.example` for a complete template.

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXTAUTH_URL` | yes | Public base URL, e.g. `http://localhost:3000` |
| `AUTH_SECRET` | yes | Long random string used to sign sessions |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | yes | Google OAuth client. Callback: `<base>/api/auth/callback/google` |
| `WASABI_ACCESS_KEY`, `WASABI_SECRET_KEY`, `WASABI_BUCKET_NAME` | yes | Storage for posters and tickets |
| `WASABI_REGION` | no | Defaults to `eu-central-1` |
| `WASABI_ENDPOINT`, `WASABI_PUBLIC_BASE` | no | Override the storage endpoint or public base URL |
| `ADMIN_EMAILS` | no | Comma-separated emails that are always admin |
| `GRAPE_REMINDER_EMAILS` | no | Comma-separated emails. When all of them are going to a screening, their calendar feed gets a "don't forget the grapes" reminder 30 minutes before. Leave empty to disable. |

### Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm start` | Apply Drizzle migrations, then `next start` (used in Docker) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Run the `node:test` suites in `tests/` |
| `npm run db:generate` | Generate a new migration from `lib/db/schema.ts` |
| `npm run db:migrate` | Apply migrations |
| `npm run db:push` | Push the schema directly (local development) |
| `npm run dev:fresh` | Regenerate, force-push the schema and start dev (local only) |

## Deployment

- **Image build** (`.github/workflows/deploy.yml`): every push to `main` builds the Docker image on a native ARM64 runner and pushes it to GitHub Container Registry as `ghcr.io/guuskaashoek/jet-project-movie-planner:latest`, with GitHub Actions layer caching.
- **Rollout**: Watchtower on the server pulls the new image and restarts the container.
- **Startup** (`scripts/start-prod.sh`): backs up `db.sqlite`, applies pending migrations, then starts Next.js on port 3000. Runtime secrets come from the server environment, never from the image.

## License

MIT, see [LICENSE](LICENSE).
