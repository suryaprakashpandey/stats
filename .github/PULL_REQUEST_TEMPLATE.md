<!-- Thanks for contributing! Keep the PR focused: one provider, one theme, one fix. See CONTRIBUTING.md. -->

## What

<!-- One or two sentences: what does this change do? -->

## Why

<!-- The problem or motivation. Link the issue it closes. -->

Closes #

## How I tested it

<!-- There's no automated test suite yet, so say what you tried by hand: which providers, templates, sizes and periods, and whether that was in local dev or the playground. -->

## Screenshots

<!-- For anything visual, drop an exported card PNG (or before / after) here. Delete this section otherwise. -->

## Checklist

<!-- Delete the lines that don't apply. -->

- [ ] `npm run typecheck`, `npm run lint` and `npm run build` pass
- [ ] The diff contains no unrelated reformatting, dependency bumps, `.env*` or `data/` files
- [ ] No API keys, tokens or personal data anywhere in the diff or this description
- [ ] New provider: `ProviderId` union, catalog entry, `src/lib/providers/<id>.ts`, registered in `src/lib/providers/index.ts`, and a README integrations row
- [ ] New theme, template or card option: checked in `/playground` across the three templates and sizes, and the exported PNG matches the preview
- [ ] Schema change: ran `npm run db:generate` and committed the generated files under `drizzle/`
