# Contributing to howitsgoing

Thanks for stopping by! howitsgoing turns live numbers (MRR, stars, downloads, …) into cute, share-ready progress cards. It is a small Next.js app, and most contributions touch one or two files: a new data provider, a theme, a card option. This guide shows you where things live and how to get a change merged.

## Ways to help

| You want to…                              | Start here                                                                                          |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Add an integration (Bluesky, crates.io, …) | [Add a provider](#add-a-provider) · issues labelled [`provider`](https://github.com/suryaprakashpandey/stats/labels/provider) |
| Add a theme or a card template            | [Add a theme](#add-a-theme) · issues labelled [`design`](https://github.com/suryaprakashpandey/stats/labels/design)          |
| Improve export and sharing                | `src/lib/cards/export.ts` · issues labelled [`export`](https://github.com/suryaprakashpandey/stats/labels/export)            |
| Improve the editor                        | `src/components/studio/` · issues labelled [`studio`](https://github.com/suryaprakashpandey/stats/labels/studio)             |
| Set up CI, tests, deployment              | issues labelled [`infra`](https://github.com/suryaprakashpandey/stats/labels/infra)                                          |
| Fix a bug or improve the docs             | Open a PR. For anything non-obvious, open an issue first so we can talk it through.                 |

Good starting points are labelled [`good first issue`](https://github.com/suryaprakashpandey/stats/labels/good%20first%20issue). Anything labelled [`help wanted`](https://github.com/suryaprakashpandey/stats/labels/help%20wanted) is open for the taking. Comment on the issue before you start so two people don't build the same thing. Have an idea that isn't an issue yet? Open one and say what you'd like to build. Small things can go straight to a PR.

## Local setup

You need Node 20 or newer and npm.

```bash
git clone https://github.com/<your-username>/stats.git
cd stats
npm install
npm run dev
```

`npm run dev` writes `.env.local` with generated secrets (`scripts/ensure-env.mjs`), and the SQLite database in `data/` migrates itself on the first request. Open http://localhost:3000, create an account with any email and password (no email is sent), connect a tool, make a card.

http://localhost:3000/playground works without an account and uses sample data. It is the quickest way to work on themes, templates and export.

`.env.local` and `data/` are git-ignored. Never commit them, and never paste real API keys into issues or PRs.

## Project map

```
src/
  app/                    Next.js App Router pages and API routes
    app/                  Signed-in area: dashboard, studio, connections (gated in app/layout.tsx)
    playground/           The studio with demo data, no account needed
    api/metrics/          GET one metric for one connection; this is what the studio calls
  components/
    card/Card.tsx         The card itself: pure, inline styles only, three templates
    card/Chart.tsx        SVG area / line / bar chart
    card/useCardData.ts   Loads and caches the metrics a card needs
    studio/               Card editor controls
    ConnectionsManager    Connect and remove tools
  lib/
    metrics/catalog.ts    Client-safe list of providers: fields, metrics, help text
    metrics/types.ts      Shared types (Period, MetricDef, ProviderId, …)
    metrics/service.ts    20-minute cache + daily snapshot log, then calls the provider
    metrics/series.ts     Date windows, bucketing and resampling helpers
    metrics/format.ts     Number, currency and change formatting shown on cards
    providers/            Server-only fetchers, one file per integration
    cards/types.ts        Card config schema (zod) and export sizes
    cards/themes.ts       Card themes
    cards/export.ts       PNG export (html-to-image) and clipboard
    db/schema.ts          Drizzle schema: Better Auth tables + connection, metric_cache, card
    crypto.ts             AES-256-GCM for stored credentials
drizzle/                  Generated SQL migrations (commit them)
scripts/ensure-env.mjs    Zero-config dev secrets
```

A few rules the codebase follows:

- Anything that handles credentials or calls a third-party API lives under `src/lib/providers/` or `src/lib/metrics/service.ts` and starts with `import "server-only"`.
- Secrets are stored encrypted (`src/lib/crypto.ts`) and are never returned to the browser. `ClientConnection` in `src/lib/metrics/types.ts` is the allow-list of what the client may know about a connection.
- Errors meant for users are thrown as `ProviderError` with a friendly message. Anything else is logged and shown as a generic message.
- `Card.tsx` uses inline styles and CSS variables only, so what you see in the studio is exactly what `html-to-image` exports.

## Add a provider

Every integration is two things: a **catalog entry** (client-safe: what to ask for when connecting, which metrics it offers) and a **server provider** (fetches the numbers). Read `src/lib/providers/npm.ts` (no credentials, a flow metric with history) and `src/lib/providers/github.ts` (optional token, level metrics, sampled history) before you start.

1. **Add the id** to the `ProviderId` union in `src/lib/metrics/types.ts`.
2. **Describe it** in `src/lib/metrics/catalog.ts`: name, emoji, pastel `color`, the `fields` a user fills in when connecting (mark API keys `secret: true`; set `instant: true` when no credentials are needed), and the `metrics` it offers. For each metric decide:
   - `kind: "level"`: a number at a point in time (followers, stars, MRR). If the API has no history, return an empty `series`; `service.ts` records one snapshot per day and a chart appears after a few refreshes.
   - `kind: "flow"`: a number that accumulates over the period (downloads, revenue, visitors). Return `previous` for the prior window so the change badge works.
   - `params`: per-card inputs such as a package or repository name.
3. **Fetch it** in `src/lib/providers/<id>.ts` by implementing `ServerProvider` from `./base`:
   - `verify(ctx)` runs once when connecting. Throw a `ProviderError` if the credentials don't work; return a `label` such as `"Stripe (Acme Inc)"`.
   - `fetch(ctx, req)` returns a `MetricResult` via `baseResult(window, { value, previous, series })`. Use `periodWindow`, `bucketFlow`, `resampleCumulative` and friends from `src/lib/metrics/series.ts` instead of writing your own date maths, and use `request` / `requestJson` from `./base` so timeouts and error messages stay consistent.
4. **Register it** in `src/lib/providers/index.ts`.
5. **Document it** with a row in the Integrations table in `README.md`.
6. **Test it by hand**: connect it at `/app/connections`, make a card with each metric across the 7d, 30d, 90d and 12m periods, and try a bad key or an unknown package to check the error message reads well.

Be polite to third-party APIs: a handful of requests per fetch at most (results are cached for 20 minutes), send a `User-Agent` when the API asks for one, and never log secrets.

## Add a theme

Themes are plain objects in `src/lib/cards/themes.ts`. Copy an existing one, give it a unique `id`, and pick colours that keep text readable: `fg` and `muted` on `bg`, and the `up` / `down` pill text on its own pill background. Set `dark: true` for dark backgrounds, and add `blobs` if you want the soft circles.

Check the theme in the playground with all three templates (Single, Stack, Milestone), all three sizes and each chart style, then download a PNG. Gradients and transparency occasionally render differently in the export. Put a screenshot or the exported PNG in your PR.

## Add a card option or template

The card config is the zod schema in `src/lib/cards/types.ts`. New options need a `.default()` so cards saved before your change keep loading. Then:

- render it in `src/components/card/Card.tsx` (inline styles only),
- add a control in `src/components/studio/Studio.tsx`,
- check the demo card in `/playground` still looks right.

A new template also needs a value in the `template` enum and its own branch in `Card`.

## Change the database

Edit `src/lib/db/schema.ts`, run `npm run db:generate`, and commit the generated files under `drizzle/`. Migrations run automatically on the next request via `ensureMigrated()`, so nothing else needs wiring up. Keep migrations additive where you can; people run this against their own SQLite files.

## Before you open a PR

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run build       # next build
```

All three should pass without new warnings. There is no automated test suite yet (see the issues labelled `infra` if you'd like to change that), so please say in the PR how you tested the change by hand.

Then:

- **Keep PRs focused.** One provider, one theme, one fix per PR. Small PRs get reviewed quickly.
- **Link the issue** (`Closes #123`) and explain the *why* in the description, not only the what.
- **Add screenshots** for anything visual. An exported card PNG says more than a paragraph.
- **Match the surrounding style**: TypeScript, 2-space indent, double quotes, trailing commas. `npm run lint` covers the rest.
- **Write commit messages in the imperative mood** ("Add crates.io provider"), like the existing history.
- Don't bump dependencies or reformat unrelated files in the same PR.

Next.js 16 differs from older versions in places. If you touch routing, caching or server actions, check the guides in `node_modules/next/dist/docs/` first (see `AGENTS.md`).

## Reporting bugs and proposing features

Open an issue and pick the **Bug report**, **Feature request** or **New provider** template; each asks for the details we need. For bugs, include your OS and browser and a screenshot when it's visual. Redact API keys and tokens.

Labels you'll see:

| Label              | Meaning                                                    |
| ------------------ | ---------------------------------------------------------- |
| `good first issue` | Scoped, documented, and a good way in                      |
| `help wanted`      | Open for anyone to pick up. Comment to claim it.           |
| `provider`         | A new or improved integration in `src/lib/providers/`      |
| `design`           | Themes, templates and other card visuals                   |
| `export`           | PNG rendering, clipboard, sharing and embeds               |
| `studio`           | The card editor and app UX                                 |
| `infra`            | CI, tests, deployment and developer tooling                |

## Security

If you find a vulnerability (credential leakage, an auth bypass, …), please don't open a public issue. Use GitHub's private vulnerability reporting ("Report a vulnerability" under the Security tab) or contact the maintainer directly.

## Be kind

Reviews and discussions should be friendly and constructive. Assume good intent; there is a person on the other side.

## License

By contributing, you agree that your contributions are licensed under the MIT License that covers the project.
