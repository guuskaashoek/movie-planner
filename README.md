## Film Calendar Board

Collaborative film calendar built with Next.js 16 App Router, SQLite + Drizzle, NextAuth (Google), Wasabi S3 uploads, an `.ics` calendar feed and an **MCP server** so an AI assistant (Grok, Claude, ...) can manage the board.

### Tech stack

- **Framework**: Next.js 16 (App Router)
- **Database**: SQLite (file `db.sqlite`) with Drizzle ORM
- **Auth**: NextAuth.js v5 (beta) with Google provider
- **Storage**: Wasabi S3-compatible bucket via `@aws-sdk/client-s3`
- **Calendar**: `ical-generator` for `.ics` feed
- **Styling**: Tailwind CSS v4 (dark mode only)
- **AI access**: Model Context Protocol server at `/api/mcp` (see section 7)

---

## 1. Environment variables

Create a `.env.local` in the project root with at least:

```bash
NEXTAUTH_URL=http://localhost:3000
AUTH_SECRET=change_me_to_a_long_random_string

GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret

WASABI_ACCESS_KEY=your-wasabi-access-key
WASABI_SECRET_KEY=your-wasabi-secret-key
WASABI_BUCKET_NAME=your-wasabi-bucket-name
WASABI_REGION=eu-central-1

# Comma separated emails that are always admins, even before any role is set
# in the database. This is how the first admin account is created.
ADMIN_EMAILS=you@example.com

# Optional: override the public base URL if you use a custom domain/CDN
# WASABI_PUBLIC_BASE=https://s3.eu-central-1.wasabisys.com/your-wasabi-bucket-name
```

- **`AUTH_SECRET`**: any long random string (used for JWT signing).
- **Google**: create OAuth credentials in Google Cloud Console and whitelist `http://localhost:3000/api/auth/callback/google`.
- **Wasabi**: use a bucket in region `eu-central-1`, and make sure objects are publicly readable (via bucket policy or ACL).
- **`ADMIN_EMAILS`**: bootstrap admins. An email listed here is an admin no matter what the database says, so you can never lock yourself out. Everyone else is promoted from the `/admin` page or over MCP.

Restart `npm run dev` whenever you change `.env`.

---

## 2. Database & Drizzle

SQLite DB file: `db.sqlite`.

Schema is defined in:

- `lib/db/schema.ts`
- `lib/db/client.ts`
- `drizzle.config.ts`

### Generate / push schema

```bash
# generate SQL migration files from the schema
npm run db:generate

# apply schema to SQLite (creates/updates db.sqlite)
npm run db:push
```

Run `npm run db:push` at least once before starting the app.

---

## 3. Auth (NextAuth + Google)

Configuration lives in:

- `lib/auth.ts` – NextAuth setup (Google provider, JWT sessions, DB user sync)
- `app/api/auth/[...nextauth]/route.ts` – auth API route

Key behaviour:

- First Google login:
  - User is inserted into `users` table with `email`, `name`, `image`, `googleId`.
- Session:
  - Uses JWT strategy.
  - Adds `user.id` (DB primary key) to the session object.
- Authorization:
  - Public routes: `/` and `/api/calendar/feed.ics`.
  - All other routes/pages require authentication.

### Roles

`users.role` is either `user` (default) or `admin`. The effective role is resolved in
`lib/authz.ts`: the stored role, or `admin` when the email appears in `ADMIN_EMAILS`.

| | member | admin |
| --- | --- | --- |
| Create films | yes | yes |
| Edit / delete films | own only | **every** film |
| Edit polls | own films | every film |
| Delete comments | own, or on own film | any comment |
| Rate a film | after attending a finished screening | any time |
| Act on behalf of another member | no | yes (`asUser`) |
| List members, change roles, transfer films | no | yes |

Permissions live in one place (`lib/films.ts`, built on `lib/authz.ts`), so the website
and the MCP server enforce exactly the same rules.

---

## 4. Running the app locally

Install dependencies:

```bash
npm install
```

Setup DB (only needed first time or after schema changes):

```bash
npm run db:push
```

Start dev server:

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## 5. Pages & flows

### `/` – Homepage

- Shows a dark hero with description and a **“Sign in with Google”** button.
- If you are already logged in, you are redirected to `/my-films`.

### `/my-films` – Personal film list

Server component: loads films for the logged-in user from `films` table.  
Client component: `app/my-films/MyFilmsClient.tsx`.

Features:

- **Add film form**:
  - Title (required)
  - Date (required)
  - Start time (optional)
  - End time (optional)
  - Description (optional)
  - Poster image upload (optional, JPEG/PNG/WebP/AVIF, max 10MB)
  - Tickets on sale date, time and booking link (optional)
- **List of personal films**:
  - Shows date, times, title, description, poster thumbnail.
  - Buttons:
    - **Send to board**: marks film as `isOnMainBoard = true` and timestamps `addedToMainBoardAt`.
    - **Delete**: removes the film from your personal list.

### `/settings` – MCP keys & calendar

- Shows the MCP endpoint URL and copy-paste configuration for Grok and other MCP clients.
- Create and revoke personal API keys. The key is shown **once**; only its SHA-256 hash is stored.
- Lists every tool the connected assistant may call with this account.
- Repeats the personal `.ics` subscription link.

### `/admin` – Admin only

- Totals for films, members, comments, votes and ratings.
- Promote or demote members (you cannot remove your own admin rights).
- Every film with its owner: transfer ownership, jump to the editor, or delete it.

### `/board` – Shared board (infinite scroll timeline)

Server component: loads first 20 films where `isOnMainBoard = true`.  
Client component: `app/board/BoardClient.tsx`.

Features:

- Infinite scrolling **timeline view**:
  - Films grouped under date headers.
  - Each card shows poster, title, times, description.
  - Loads 20 films at a time via `/api/board?page=N`.
- `.ics` subscription URL:
  - At the top of the page, an input shows the URL to the `.ics` feed.
  - You can copy this into Google Calendar / Apple Calendar / etc.

---

## 6. API routes

### `GET /api/films`

- Returns films belonging to the authenticated user.
- Response: `{ films: Film[] }`.

### `POST /api/films`

- Creates a new film for the authenticated user.
- Body (JSON):

```json
{
  "title": "string",
  "description": "string|null",
  "date": "YYYY-MM-DD",
  "releaseDate": "YYYY-MM-DD|null",
  "startTime": "HH:mm|null",
  "endTime": "HH:mm|null",
  "formats": "IMAX,3D|null",
  "ticketsOnSaleDate": "YYYY-MM-DD|null",
  "ticketsOnSaleTime": "HH:mm|null",
  "ticketsUrl": "https://...|null",
  "posterUrl": "https://...|null"
}
```

From the web the `posterUrl` must be a URL returned by `/api/upload`; importing a
poster from an arbitrary link is an MCP-only feature.

### `PATCH /api/films/[id]`

- Updates fields of a film owned by the user.
- Special behaviour:
  - If `isOnMainBoard: true` is sent, `addedToMainBoardAt` is set to `Date.now()`.

### `DELETE /api/films/[id]`

- Deletes a film owned by the user, or any film when the caller is an admin.
- Answers `404` when the film does not exist and `403` when it is not yours.

### `GET|POST /api/keys`, `DELETE /api/keys/[id]`

- Manage personal MCP API keys. `POST` returns the plaintext token once.

### `PUT /api/admin/users/[id]/role`, `PUT /api/admin/films/[id]/transfer`

- Admin only: change a member's role, or hand a film to another owner.

### `GET /api/board?page=N`

- Returns films on the main board (`isOnMainBoard = true`) in chronological order.
- Query:
  - `page` – zero-based page index (0, 1, 2, …).
- Response:

```json
{
  "films": [/* 0–20 Film items */],
  "hasMore": true
}
```

### `POST /api/upload`

- Auth required.
- Expects `multipart/form-data` with a `file` field.
- Validations:
  - Types: `image/jpeg`, `image/jpg`, `image/png`, `image/webp`, `image/avif`.
  - Max size: 10MB.
  - The file's **magic bytes** must match one of those formats; the declared
    content type and the filename are not trusted.
- Uploads to Wasabi using `S3Client` and `PutObjectCommand`.
- Response:

```json
{
  "url": "https://public-wasabi-url/path/to/file.ext"
}
```

Use this URL in `films.posterUrl`.

### `GET /api/calendar/feed.ics`

- Public endpoint (no auth).
- Generates an `.ics` calendar feed from all films where `isOnMainBoard = true`.
- Uses `Europe/Amsterdam` timezone.
- Each film becomes an event with:
  - `summary`: film title
  - `description`: film description
  - `start` / `end`: combined from `date`, `startTime`, `endTime`

You can subscribe to this URL from `/board` in your calendar application.

---

## 7. MCP server (Grok & other AI assistants)

The app exposes a **Model Context Protocol** server so an AI assistant can manage the
whole board: `POST /api/mcp`.

- **Transport**: Streamable HTTP, stateless. Everything is JSON-RPC 2.0 over `POST`
  (`GET`/`DELETE` answer `405`; notifications answer `202` with no body).
- **Protocol versions**: `2025-06-18`, `2025-03-26`, `2024-11-05`.
- **Auth**: `Authorization: Bearer mp_...` — a personal API key from `/settings`.
  `X-Api-Key` and `?token=` are accepted for clients that cannot set the header.
- **Permissions**: a key inherits its owner's role. An admin's key can edit, move and
  delete *every* member's films and act on behalf of others; a member's key cannot.
  Admin-only tools are hidden from non-admin keys and refused server-side as well.

### Connecting Grok (xAI)

Add the server to the `tools` array of your request. xAI puts the `authorization`
value into the `Authorization` header; the server accepts the key with or without a
`Bearer ` prefix, so either form works:

```json
{
  "type": "mcp",
  "server_label": "movie-planner",
  "server_url": "https://your-domain/api/mcp",
  "authorization": "mp_your_key_here"
}
```

### Connecting Claude Code, Cursor and other MCP clients

```json
{
  "mcpServers": {
    "movie-planner": {
      "type": "http",
      "url": "https://your-domain/api/mcp",
      "headers": { "Authorization": "Bearer mp_your_key_here" }
    }
  }
}
```

### Tools

| Tool | What it does |
| --- | --- |
| `whoami` | The account behind this key and what it may do |
| `list_films` | List/search films (`scope`: all, upcoming, past, mine) |
| `get_film` | One film with poll, attendees, ratings and comments |
| `create_film` | Add a film, optionally with a poster URL and a date poll |
| `update_film` | Change any field of a film |
| `set_tickets_on_sale` | Record when tickets are released (+ booking link) |
| `set_film_poster` | Re-host a poster from any public image URL |
| `delete_film` | Delete a film and everything attached to it |
| `set_poll` | Replace the date poll of a film |
| `vote_poll` | Cast or withdraw a vote |
| `set_attendance` | Going / interested, on or off |
| `add_comment`, `delete_comment` | Discussion thread |
| `rate_film` | 1–5 stars |
| `get_calendar_url` | Personal `.ics` subscription link |
| `list_users` *(admin)* | Every member with role and film count |
| `set_user_role` *(admin)* | Promote or demote a member |
| `transfer_film` *(admin)* | Give a film to another owner |
| `get_stats` *(admin)* | Board totals and films per owner |

Tools that change something on behalf of someone else (`vote_poll`, `set_attendance`,
`rate_film`, `create_film`) take an `asUser` / `owner` argument that only admins may use.

### Poster import

`create_film`, `update_film` and `set_film_poster` accept **any public image URL**. The
server downloads it, verifies it is really a JPEG, PNG, WebP or AVIF by inspecting its
magic bytes, and stores it in our own bucket, so the board never depends on someone
else's URL staying alive. The fetch is hardened against SSRF: http(s) only, private,
loopback and link-local addresses are refused, every redirect hop is re-checked, and the
download is capped at 10MB.

---

## 8. Styling notes

- Dark mode only:
  - Backgrounds: black / deep grays.
  - Text: zinc/white tones.
- No gradients: only solid colors and borders.
- Tailwind v4 is wired via `app/globals.css` (no standalone `tailwind.config.js` required).

