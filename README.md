## Film Calendar Board

Collaborative film calendar built with Next.js 16 App Router, SQLite + Drizzle, NextAuth (Google), Wasabi S3 uploads and an `.ics` calendar feed.

### Tech stack

- **Framework**: Next.js 16 (App Router)
- **Database**: SQLite (file `db.sqlite`) with Drizzle ORM
- **Auth**: NextAuth.js v5 (beta) with Google provider
- **Storage**: Wasabi S3-compatible bucket via `@aws-sdk/client-s3`
- **Calendar**: `ical-generator` for `.ics` feed
- **Styling**: Tailwind CSS v4 (dark mode only)

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

# Optional: override the public base URL if you use a custom domain/CDN
# WASABI_PUBLIC_BASE=https://s3.eu-central-1.wasabisys.com/your-wasabi-bucket-name
```

- **`AUTH_SECRET`**: any long random string (used for JWT signing).
- **Google**: create OAuth credentials in Google Cloud Console and whitelist `http://localhost:3000/api/auth/callback/google`.
- **Wasabi**: use a bucket in region `eu-central-1`, and make sure objects are publicly readable (via bucket policy or ACL).

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
  - Poster image upload (optional, jpg/jpeg/png/webp, max 5MB)
- **List of personal films**:
  - Shows date, times, title, description, poster thumbnail.
  - Buttons:
    - **Send to board**: marks film as `isOnMainBoard = true` and timestamps `addedToMainBoardAt`.
    - **Delete**: removes the film from your personal list.

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
  "startTime": "HH:mm|null",
  "endTime": "HH:mm|null",
  "posterUrl": "https://...|null"
}
```

### `PATCH /api/films/[id]`

- Updates fields of a film owned by the user.
- Special behaviour:
  - If `isOnMainBoard: true` is sent, `addedToMainBoardAt` is set to `Date.now()`.

### `DELETE /api/films/[id]`

- Deletes a film owned by the user.

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
  - Types: `image/jpeg`, `image/jpg`, `image/png`, `image/webp`.
  - Max size: 5MB.
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

## 7. Styling notes

- Dark mode only:
  - Backgrounds: black / deep grays.
  - Text: zinc/white tones.
- No gradients: only solid colors and borders.
- Tailwind v4 is wired via `app/globals.css` (no standalone `tailwind.config.js` required).

