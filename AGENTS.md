# AGENTS.md

Bun + TypeScript monorepo scaffolded by Better-T-Stack: TanStack Start (React SSR) web app, Convex backend, Better-Auth, shared shadcn/ui package, Alchemy/Cloudflare deploy.

## Commands

Package manager is **Bun** (`bun@1.4.2`). Task runner is **`vp`** (vite-plus).

- `bun install` — postinstall regenerates `apps/web/src/env.ts` via Varlock.
- `bun run dev:setup` — first-time Convex project setup (`convex dev --configure`). Run before `bun run dev`.
- `bun run dev` — all apps. `bun run dev:web` — web only (port 3001). `bun run dev:server` — Convex only.
- `bun run check-types` — `vp run -r check-types` across workspaces.
- `bun run lint` (`vp lint`) / `bun run format` (`vp fmt`) / `bun run staged`.
- `bun run check` — **`oxlint && oxfmt --write`** (direct binaries, not `vp check`); it rewrites files.
- Run one workspace task: `vp run --filter <pkg> <script>` (e.g. `vp run --filter web build`).

## Gotchas

- **No test suite exists.** There is no test runner, config, or `test` script despite `@testing-library/*` and `jsdom` devDeps. Do not assume `bun test` works.
- `apps/web` `check-types` is `vp build && tsc --noEmit`. `src/routeTree.gen.ts` is generated and gitignored, so bare `tsc` in `apps/web` fails until a build/dev run generates it.
- **Never edit generated files**: `apps/web/src/routeTree.gen.ts`, `apps/web/src/env.ts`, `packages/backend/convex/_generated/**`. They are also excluded from lint/fmt.
- Versions use Bun's `catalog:` protocol; add/adjust shared dependency versions in the root `package.json` `workspaces.catalog`, not per-package.
- TS is strict with `noUncheckedIndexedAccess`, `noUnusedLocals/Parameters`, and `verbatimModuleSyntax` (use `import type`).
- Formatting is oxfmt: `semi: true`, `singleQuote: false`, and it sorts `package.json`.

## Environment (Varlock)

- `bunfig.toml` sets `env = false`; Bun's auto env loading is disabled — Varlock loads env.
- Each app owns a `.env.schema`. After editing a schema run `bun run env:generate` (`varlock codegen --path ./apps/web/`). Import the generated typed accessor, not `process.env`.
- Web public vars live in `apps/web/.env.schema` (`VITE_CONVEX_URL`, `VITE_CONVEX_SITE_URL`). Copy values from `packages/backend/.env.local` into `apps/web/.env`.
- Backend server vars (`SITE_URL`, `BETTER_AUTH_SECRET`) are set on the Convex deployment with `npx convex env set ...`, not in `.env.schema`.

## Project Structure

`node_modules/`, `dist/`, and `.alchemy/`/`.wrangler/` build artifacts are omitted.

```
jev-usecase/
├── .gitignore                   # ignores node_modules, dist, generated routeTree/env, .env*
├── .oxfmtrc.json                # oxfmt config (empty; real opts in root vite.config.ts)
├── .oxlintrc.json               # oxlint: typescript/unicorn/oxc, correctness=error
├── AGENTS.md                    # this file
├── README.md                    # scaffold docs: setup, scripts, UI, deploy
├── bts.jsonc                    # Better-T-Stack metadata + reproducible create command
├── bun.lock                     # Bun lockfile
├── bunfig.toml                  # env = false (disables Bun auto env loading)
├── package.json                 # bun workspaces + catalog + vp task scripts
├── tsconfig.json                # extends @jev-usecase/config/tsconfig.base.json
├── vite.config.ts               # root vp lint/fmt/staged config for all workspaces
├── apps/
│   └── web/                     # React + TanStack Start SSR app (port 3001)
│       ├── .env                 # local public env values (gitignored)
│       ├── .env.schema          # Varlock: NODE_ENV, VITE_CONVEX_URL, VITE_CONVEX_SITE_URL
│       ├── .gitignore           # ignores build output, .env*, /src/env.ts
│       ├── bunfig.toml          # env = false for this workspace
│       ├── components.json      # shadcn config (base-lyra; css -> packages/ui globals)
│       ├── package.json         # scripts: build, serve, check-types, dev:bare, env:generate
│       ├── tsconfig.json        # @/* and @jev-usecase/ui/* path aliases
│       ├── vite.config.ts       # tailwind + tanstackStart + react plugins
│       ├── public/
│       │   └── robots.txt       # static crawl rules
│       └── src/
│           ├── env.ts           # GENERATED Varlock typed env — do not edit
│           ├── env.public.ts    # typed import.meta.env accessor for public vars
│           ├── index.css        # imports @jev-usecase/ui/globals.css
│           ├── router.tsx       # TanStack Router + ConvexQueryClient/React Query bridge
│           ├── routeTree.gen.ts # GENERATED TanStack Router tree — do not edit
│           ├── components/
│           │   ├── header.tsx        # top nav (Home / Dashboard links)
│           │   ├── loader.tsx        # spinner used as router pending component
│           │   ├── sign-in-form.tsx  # email/password sign-in (react-form + zod)
│           │   ├── sign-up-form.tsx  # email/password sign-up (react-form + zod)
│           │   └── user-menu.tsx     # account dropdown + sign out
│           ├── lib/
│           │   ├── auth-client.ts    # better-auth React client with convex plugin
│           │   └── auth-server.ts    # convexBetterAuthReactStart helpers (token/handler)
│           └── routes/
│               ├── __root.tsx            # root route: auth bootstrap, providers, layout
│               ├── index.tsx             # "/" home; calls healthCheck query
│               ├── _auth/
│               │   ├── route.tsx         # auth-gated layout (sign in/up vs Outlet)
│               │   └── dashboard.tsx     # "/dashboard" protected page
│               └── api/auth/$.ts         # mounts Better-Auth handler at /api/auth/*
├── packages/
│   ├── backend/                 # Convex backend (@jev-usecase/backend)
│   │   ├── .env.local           # local VITE_CONVEX_* / SITE_URL (gitignored)
│   │   ├── .gitignore           # ignores .env.local
│   │   ├── package.json         # scripts: dev, dev:setup (convex CLI)
│   │   └── convex/
│   │       ├── README.md             # Convex function authoring reference
│   │       ├── auth.config.ts        # Convex auth provider config
│   │       ├── auth.ts               # betterAuth client + getCurrentUser query
│   │       ├── convex.config.ts      # registers betterAuth component
│   │       ├── healthCheck.ts        # healthCheck.get query
│   │       ├── http.ts               # httpRouter registering Better-Auth routes
│   │       ├── privateData.ts        # privateData.get auth-gated query
│   │       ├── schema.ts             # empty defineSchema (no tables yet)
│   │       ├── tsconfig.json         # Convex function tsconfig
│   │       └── _generated/           # GENERATED by convex — do not edit
│   ├── ui/                      # shared shadcn primitives (@jev-usecase/ui)
│   │   ├── components.json      # shadcn config for the shared package
│   │   ├── package.json         # subpath exports: components/lib/hooks/styles
│   │   ├── postcss.config.mjs   # @tailwindcss/postcss plugin
│   │   ├── tsconfig.json        # jsx + UI path alias
│   │   └── src/
│   │       ├── components/      # primitives (button, card, input, label, checkbox,
│   │       │                    #   textarea, dropdown-menu, tooltip, sonner, skeleton,
│   │       │                    #   input-group, empty) + chat UI (bubble, message,
│   │       │                    #   message-scroller, attachment, marker)
│   │       ├── hooks/           # .gitkeep only (no hooks yet)
│   │       ├── lib/utils.ts     # re-exports cn from "cn"
│   │       └── styles/globals.css  # Tailwind v4 theme + design tokens
│   ├── infra/                   # Alchemy deploy stack (@jev-usecase/infra)
│   │   ├── .env.schema          # imports web vars + ALCHEMY_PASSWORD
│   │   ├── package.json         # scripts: dev, deploy, destroy (alchemy)
│   │   ├── tsconfig.json        # includes alchemy.run.ts
│   │   └── alchemy.run.ts       # Stack: Cloudflare Website.Vite("web")
│   └── config/                  # shared TS config (@jev-usecase/config)
│       ├── package.json         # config-only package (no scripts)
│       └── tsconfig.base.json   # strict base tsconfig extended by packages
```

## Architecture

- `apps/web` — TanStack Start + React, TanStack Query bridged to Convex (`src/router.tsx`). File-based routes in `src/routes`; `_auth` layout gates on auth. Auth server helpers in `src/lib/auth-server.ts`, client in `src/lib/auth-client.ts`.
- `packages/backend` — Convex functions in `convex/` (`http.ts` registers Better-Auth routes, `auth.ts` creates the client, `schema.ts` is currently empty). Depends on `@convex-dev/better-auth`.
- `packages/ui` — shared shadcn primitives, imported by subpath: `@jev-usecase/ui/components/button`, `@jev-usecase/ui/lib/utils` (`cn`), `/hooks/*`, `/globals.css`. Add shared components with `npx shadcn@latest add <name> -c packages/ui`; app-specific blocks from `apps/web`.
- `packages/infra` — Alchemy stack (`alchemy.run.ts`) deploying web to Cloudflare. Deploy `bun run deploy` / `bun run destroy`; defaults to a personal `dev_<username>` stage. Production: `cd packages/infra && bunx alchemy deploy --stage production`.
- `packages/config` — shared `tsconfig.base.json` extended by packages.

Path aliases: `@/*` -> `apps/web/src/*`; `@jev-usecase/ui/*` -> `packages/ui/src/*` (see `apps/web/tsconfig.json`).
