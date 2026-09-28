# Contributing

Remappr is a cross-platform keymap editor — a single React UI in an Electron shell, with per-vendor firmware adapters. Full setup lives
in the [project README](https://github.com/Wolffyx/remappr#readme);
this page is the short version plus how to work on these docs.

## Prerequisites

- Node.js ≥ 20 (see `.nvmrc`)
- pnpm 10.30.x (`corepack enable`)
- Linux: BlueZ + D-Bus for native BLE; macOS: Xcode CLT for `node-hid` /
  `serialport` builds

## Setup

```sh
pnpm install
```

## Common commands

| Command          | Purpose                                                    |
| ---------------- | ---------------------------------------------------------- |
| `pnpm edev`      | Electron dev (renderer + main + preload, hot reload)       |
| `pnpm dev`       | Renderer-only Vite dev server (browser preview, port 5174) |
| `pnpm typecheck` | `tsc --noEmit` (node + web projects)                       |
| `pnpm lint`      | ESLint                                                     |
| `pnpm test`      | Vitest                                                     |
| `pnpm format`    | Prettier                                                   |

## Working on the docs

These docs are a [VitePress](https://vitepress.dev) site under `docs/`.

```sh
pnpm docs:dev       # local dev server with hot reload
pnpm docs:build     # production build → docs/.vitepress/dist
pnpm docs:preview   # preview the production build
```

- Pages are Markdown under `docs/{guide,reference,dev}/`.
- Navigation and the sidebar are configured in `docs/.vitepress/config.ts`.
- Static assets (logo, favicon) live in `docs/public/`.

### Screenshots

Guide pages mark where a screenshot belongs with a callout:

```md
::: info 📷 Screenshot slot — `docs/public/images/builder/overview.png`
What the shot should show.
:::
```

Drop the PNG/WebP at that path under `docs/public/images/{builder,editor,app}/`
and replace the callout with an image tag:

```md
![Builder overview](/images/builder/overview.png)
```

`docs/public/images/README.md` lists the convention.

The config reference pages mirror `src/firmware/config/types.ts`,
`schema.ts` and `capabilities.ts` — when you change those types, update the
matching reference page so they don't drift.

### Deployment

The docs deploy to **docs.remappr.com** on Cloudflare Pages via
`.github/workflows/docs.yml` (push to `main` touching `docs/**`). The app itself
deploys separately to **remappr.com** on GitHub Pages — the two are independent.

## Code conventions

- The config layer (`src/firmware/config/`) must stay UI-free and depend only on
  the catalog + shared types.
- Compilers gate unsupported features through `CAPABILITY_MATRIX` (warn + no-op),
  not ad-hoc `if (target === …)` branches.
- Keep the canonical `ConfigKeymap` as the single source of truth — don't add a
  parallel runtime model.

See the [architecture](/dev/architecture) and [compilers](/dev/compilers) pages
for the bigger picture.
