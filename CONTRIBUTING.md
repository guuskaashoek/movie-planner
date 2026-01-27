## Contributing to Film Calendar Board

Thanks for considering contributing!

### How to get started

1. **Fork** the repository on GitHub.
2. **Clone** your fork locally and install dependencies:

```bash
npm install
npm run db:push
npm run dev
```

3. Create a feature branch:

```bash
git checkout -b feature/my-change
```

4. Make your changes and add tests or small examples where it makes sense.
5. Run the app and verify the main flows still work:
   - Google sign‑in.
   - Creating films on `/my-films`.
   - Sending films to the board and viewing `/board`.

### Coding guidelines

- **TypeScript + Next.js App Router**:
  - Prefer server components for data‑fetching.
  - Use client components only when you need interactivity/state.
- **Styling**:
  - Use Tailwind utility classes.
  - Dark mode only, **no gradients**.
- **Database**:
  - All schema changes go through `lib/db/schema.ts`.
  - Run `npm run db:generate` and `npm run db:push` as needed.

### Commit & PR guidelines

- Keep commits focused and relatively small.
- Use clear commit messages (present tense, e.g. `add board timeline infinite scroll`).
- In your pull request description, mention:
  - What you changed and why.
  - How you tested it (steps or screenshots).

### Contact

If you’re unsure about something or want to discuss a bigger change first, feel free to open a **draft PR** or an **issue** and tag:

- **Maintainer**: Guus Kaashoek (`guus@guuslab.com`)

