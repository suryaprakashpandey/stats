# ✦ howitsgoing

[![CI](https://github.com/suryaprakashpandey/stats/actions/workflows/ci.yml/badge.svg)](https://github.com/suryaprakashpandey/stats/actions/workflows/ci.yml)

Cute, share-ready progress cards for your app — MRR, active users, GitHub stars, downloads — pulled straight from the tools you already use. Connect once, download fresh images forever.

- **Connect** Stripe, PostHog, GitHub, Plausible, Lemon Squeezy, npm, PyPI (or type a number manually).
- **Design** a card: single number, a stack of stats, or a milestone. 10 themes, 3 social sizes, stickers, captions.
- **Save** it. Every time you come back the numbers are fresh. One click → 2× retina PNG (or copy straight to the clipboard).

## Quick start

```bash
npm install
npm run dev
```

That's it. On first run `scripts/ensure-env.mjs` writes `.env.local` with generated secrets, and the SQLite database (`data/howitsgoing.db`) migrates itself. Open http://localhost:3000, create an account with email + password, connect a tool, make a card.

Try it without an account at http://localhost:3000/playground (sample data).

## Integrations

| Tool          | What you paste                                   | Metrics                                                            |
| ------------- | ------------------------------------------------ | ------------------------------------------------------------------ |
| Stripe        | Restricted API key (read-only)                   | MRR, revenue, customers, active subscriptions                      |
| PostHog       | Personal API key (`query:read`) + project ID     | Daily/weekly/monthly actives, pageviews, total users, event counts |
| GitHub        | Nothing (or a PAT / your GitHub login)           | Stars (with history), forks, release downloads, followers          |
| Plausible     | API key + site domain                            | Visitors, pageviews, visits                                        |
| Lemon Squeezy | API key                                          | MRR, revenue, customers, active subscriptions                      |
| npm           | Nothing                                          | Package downloads                                                  |
| PyPI          | Nothing                                          | Package downloads                                                  |
| Manual        | Nothing                                          | Any number; history is recorded each time you refresh              |

Adding a provider is one file in `src/lib/providers/` plus a catalog entry in `src/lib/metrics/catalog.ts`.

## Configuration

All variables are optional in development. See `.env.example`.

| Variable                                   | Purpose                                                                                                           |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `BETTER_AUTH_URL`                          | Public URL of the app (default `http://localhost:3000`).                                                          |
| `BETTER_AUTH_SECRET`                       | Session signing secret. Generated automatically in dev.                                                           |
| `ENCRYPTION_KEY`                           | 32-byte key (hex) used to encrypt third-party API keys at rest. Generated automatically in dev; required in prod. |
| `DATABASE_URL`                             | `file:./data/howitsgoing.db` by default. Use a Turso/libSQL URL (`libsql://…`) with `DATABASE_AUTH_TOKEN` in prod. |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | Enables "Continue with GitHub". Callback URL: `<BETTER_AUTH_URL>/api/auth/callback/github`.                        |

## How it works

- **Next.js 16** (App Router) + Tailwind v4. Auth by [Better Auth](https://better-auth.com), data via Drizzle + libSQL.
- Credentials are encrypted with AES-256-GCM before they hit the database and are only ever decrypted server-side to call the provider's API.
- Metric results are cached for 20 minutes per (connection, metric, period). Metrics whose source has no history (forks, followers, manual numbers) get a daily snapshot log, so charts appear after a couple of refreshes.
- Cards are rendered as real DOM at their true pixel size and exported with `html-to-image` at 2× — what you see is exactly what you download.

## Scripts

| Command           | What it does                                    |
| ----------------- | ----------------------------------------------- |
| `npm run dev`     | Start the dev server (creates `.env.local`).    |
| `npm run build`   | Production build.                               |
| `npm run typecheck` | `tsc --noEmit`.                               |
| `npm run db:generate` | Generate a migration after editing the schema. |
| `npm run db:studio` | Browse the database with Drizzle Studio.      |

## Deploying to Vercel + Turso

Any Node host works; this is the zero-ops path.

1. **Create the project**: `npx vercel link --yes --project howitsgoing` (or import the repo in the Vercel dashboard).
2. **Database**: install the Turso marketplace integration and connect it to the project. It injects `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`, which the app reads automatically. In production the app uses the pure-fetch libSQL client, so no native binaries are involved.
   ```bash
   npx vercel integration add tursocloud/database -n howitsgoing-db --plan starter -e production -e preview --no-env-pull
   ```
   Any other libSQL/Turso database works too: set `DATABASE_URL` + `DATABASE_AUTH_TOKEN` instead.
3. **Secrets** (production and preview):
   ```bash
   openssl rand -base64 32 | npx vercel env add BETTER_AUTH_SECRET production
   openssl rand -hex 32    | npx vercel env add ENCRYPTION_KEY production
   ```
4. **GitHub sign-in** (optional): create an OAuth app at https://github.com/settings/developers with homepage `https://<your-domain>` and callback `https://<your-domain>/api/auth/callback/github`, then add `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` the same way.
5. **Migrate & deploy**: migrations also run lazily on first request, but running them once up front is cleaner:
   ```bash
   npx vercel env pull .env.production.local --environment production
   set -a; source .env.production.local; set +a
   DATABASE_URL="$TURSO_DATABASE_URL" DATABASE_AUTH_TOKEN="$TURSO_AUTH_TOKEN" npx drizzle-kit migrate
   npx vercel deploy --prod
   ```

`BETTER_AUTH_URL` is derived from Vercel's production domain when unset. Set it explicitly if you attach a custom domain and want auth callbacks pinned to it.

## Contributing

Contributions are welcome, new integrations, themes and templates especially. [CONTRIBUTING.md](CONTRIBUTING.md) covers local setup and has step-by-step guides for adding a provider or a theme. Then pick something from the [good first issues](https://github.com/suryaprakashpandey/stats/labels/good%20first%20issue).

## License

MIT
