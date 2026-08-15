# Web app

Next.js App Router is the default when the product has a browser UI. It owns the pages, server components, server actions, and the browser's private data path. When other clients exist (CLI, mobile, services, agents), the [API server](api-server.md) mounts inside the same Next app under `/api` and those clients use it; the browser does not.

Self-hosted on Node (Railway, a Docker host). Nothing here depends on Vercel.

## Scaffold

Run once, from the repository root:

```sh
bunx create-next-app@latest apps/web --ts --app --tailwind --no-eslint --no-src-dir --import-alias "@/*" --use-bun --skip-install --turbopack --yes
rm apps/web/README.md apps/web/CLAUDE.md
```

Then replace what it wrote: `apps/web/package.json` (name, exact pins from the table below, no `ignoreScripts`), `apps/web/tsconfig.json` (extend the root and keep the Next plugin, see below), `next.config.ts` (see Configuration). Keep its `.gitignore` or fold the entries into the root one. Keep `apps/web/AGENTS.md`: `next dev` rewrites it on every run with a block that points agents at `node_modules/next/dist/docs`, and committing it is the only way to keep the tree clean.

Then the UI kit:

```sh
cd apps/web && bunx shadcn@latest init -b base -p nova --no-monorepo --no-pointer -y
bunx shadcn@latest add button input textarea dialog
```

`-p` is required; without a preset the CLI prompts and an agent hangs. Do not pass `-t`; that creates a new project. `init` adds `shadcn`, `lucide-react`, and `tw-animate-css` as runtime dependencies (its `globals.css` imports `shadcn/tailwind.css`) and rewrites the root `tsconfig.json` formatting; run `bun run fmt` afterward.

## Packages

- `apps/web`: the Next project. `app/` (routes, layouts, `globals.css`), `components/` (UI kit and feature components), `lib/` (client helpers), `proxy.ts` if request-time redirects or headers are needed, `next.config.ts`, `postcss.config.mjs`, `tsconfig.json`.
- `apps/web/app/api/[[...route]]/route.ts` when the API server is mounted:

  ```ts
  import { createApp } from '@scope/api'
  const app = createApp(dependencies)
  const handler = (request: Request) => app.fetch(request)
  export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE }
  ```

  `hono/vercel`'s `handle` is the same two lines; skip the import.

## Dependencies

| Package                                    | Version      | Where                                                                                                                                                            |
| ------------------------------------------ | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `next`                                     | 16.3.1       | deps                                                                                                                                                             |
| `react`, `react-dom`                       | 19.2.8       | deps (App Router bundles its own React canary; the pin is for tooling)                                                                                           |
| `@base-ui/react`                           | 1.7.0        | deps                                                                                                                                                             |
| `@tanstack/react-query`                    | 5.101.4      | deps, client-side server state only                                                                                                                              |
| `lucide-react`, `tw-animate-css`, `shadcn` | see registry | deps, added by `shadcn init`; keep the versions it writes                                                                                                        |
| `zod`                                      | 4.4.3        | deps, form parsing in server actions                                                                                                                             |
| `clsx`                                     | 2.1.1        | deps                                                                                                                                                             |
| `tailwind-merge`                           | 3.6.0        | deps                                                                                                                                                             |
| `class-variance-authority`                 | 0.7.1        | deps (idle since 2024, still what shadcn generates)                                                                                                              |
| `sharp`                                    | 0.35.3       | deps, image optimization when self-hosting                                                                                                                       |
| `tailwindcss`, `@tailwindcss/postcss`      | 4.3.3        | dev                                                                                                                                                              |
| `typescript`                               | root pin     | dev; Next resolves it from `apps/web`, not from the root, under the isolated linker. Missing it, `next build` auto-installs with yarn and litters `.pnp.*` files |
| `@types/node`                              | current      | dev, same reason                                                                                                                                                 |
| `babel-plugin-react-compiler`              | 1.0.0        | dev, required by `reactCompiler: true`. Missing it, Turbopack panics with an unrelated message; `next build --webpack` shows the real error                      |
| `@types/react`                             | 19.2.18      | dev                                                                                                                                                              |
| `@types/react-dom`                         | 19.2.4       | dev                                                                                                                                                              |
| `@playwright/test`                         | 1.62.1       | root dev, for the smoke test                                                                                                                                     |

Bun installs and runs tests; Node runs production. Next requires Node 20.9+; both 22 and 26 run the standalone output.

`apps/web/tsconfig.json` extends the root, sets `jsx: "preserve"`, `allowJs`, `incremental`, `plugins: [{ name: "next" }]`, `paths: { "@/*": ["./*"] }`, and includes `next-env.d.ts`, `**/*.ts`, `**/*.tsx`, `.next/types/**/*.ts`. The root `tsconfig.json` excludes `apps/web/**`.

## Configuration

`next.config.ts`:

```ts
const config: NextConfig = {
  output: 'standalone',
  cacheComponents: true,
  outputFileTracingIncludes: { '/*': ['node_modules/sharp/**/*'] },
  experimental: { serverActions: { allowedOrigins: [/* public hostnames behind the proxy */] } },
  async headers() {
    return [{ source: '/api/:path*', headers: [{ key: 'X-Accel-Buffering', value: 'no' }] }]
  },
}
```

- `cacheComponents: true` turns on partial prerendering and makes everything dynamic unless a function or component says `"use cache"`. The per-route `dynamic`, `revalidate`, and `fetchCache` exports do not exist in this mode; agents reach for them from older training data. Cache with `"use cache"` plus `cacheLife()` and `cacheTag()`.
- A page is prerendered static at build unless Next sees something dynamic in it (`cookies()`, `headers()`, `searchParams`, an uncached `fetch`). A page that reads a repository or database directly looks static and will never reflect writes. Put `await connection()` (from `next/server`) at the top of every page that must show current data. The build summary marks such pages `◐`; a `○` next to a data page is the bug.
- Server components, server actions, and route handlers are separate server bundles. A module-level value in `lib/` is created once per bundle, so in-memory state is not shared between a page and the mounted API. Treat that as the design, not an obstacle: every process-local shortcut it blocks would also break the first horizontal scale-out. Construct clients (database, queue, cache) in `lib/`; keep no state there.
- `notFound()` inside a partially prerendered page streams the 404 body under HTTP 200. That is by design; check the rendered text, not the status, when verifying.
- `proxy.ts` replaced `middleware.ts` in Next 16 and runs on Node. Do not create `middleware.ts`.
- `runtime = 'edge'` is deprecated and `maxDuration` does nothing off Vercel. Do not add either.
- Streaming (SSE from a route handler, streaming SSR) works on Node. `X-Accel-Buffering: no` stops nginx-style proxies from buffering. Compression layers can still buffer; check the deployment.
- Multi-instance (replicas, rolling deploys): set `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` at build on every instance, or actions fail across instances. The default cache is per instance; configure `cacheHandler` (the Redis example in the Next repo) only when a second replica exists.

## Styling and components

Tailwind 4 with no config file: `postcss.config.mjs` contains `{ plugins: { '@tailwindcss/postcss': {} } }`, and `app/globals.css` starts with `@import 'tailwindcss'` followed by `@theme { ... }` tokens. Import it from the root layout.

Base UI provides headless primitives. `bunx shadcn@latest init -b base` generates the kit into `components/ui` on Base UI and Tailwind; add components with `bunx shadcn@latest add <name>`. After copy the files are yours: edit them, do not re-generate over edits.

Invariants (add to `AGENTS.md`):

- Visual decisions live in this repository: tokens in `@theme`, primitives in `components/ui`. Do not add a second component library or a published theme.
- Pages compose the primitives. No one-off buttons, no raw hex, rgb, or gray-scale utilities outside `globals.css`.
- Interactive overlays use the Base UI wrappers. No raw `<dialog>` or hand-rolled focus trap.
- Base UI exposes state as presence attributes: style with `data-open:`, `data-checked:`, `data-highlighted:`. Radix-style `data-[state=open]:` compiles and never matches.
- Server components by default. Add `"use client"` only where a component needs state, effects, or browser APIs, and keep that boundary as low in the tree as possible.
- Data for the page comes from server components and server actions calling `libs` directly. The browser calls the mounted `/api` only for things a non-browser client would also do (rare). TanStack Query is for client-side state that must refetch or update optimistically after hydration.
- Forms use server actions with `useActionState` and `useOptimistic`. `useState` is a last resort.
- Every route segment has `error.tsx` and `loading.tsx` or inherits them.

## Nudge rules

- `web-no-radix-state-selector`: on `**/*.tsx`, regex `data-\[state=`; message: "Base UI exposes presence attributes; use `data-open:` and friends." Fixtures both ways.
- `web-no-middleware-file`: `PreToolUse` `Write` on `**/middleware.ts` (any depth under `apps/web`); message: "Next 16 uses `proxy.ts`."
- `react-no-manual-memoization`: on `**/*.tsx`, regex `\\b(?:useMemo|useCallback|memo)\\s*\\(`; message: "The React Compiler owns memoization." Requires `reactCompiler: true` in `next.config.ts` (stable in Next 16); enable it.

## Tests

- `libs` and the mounted Hono app: `bun test`, in-process, no port.
- Client components: `bun test` with happy-dom, rendering the component with its props. Do not render server components this way; Next documents that async server components are not unit-testable in Vitest or Jest either.
- Server components, server actions, and routing: one Playwright smoke test in `tests/e2e` against the built standalone server. `playwright.config.ts` at the root uses `webServer` with the copy step and `node apps/web/.next/standalone/apps/web/server.js` (a monorepo standalone nests under `apps/web`). It runs in `ci`, not `check`. Locally, run `bunx playwright install --with-deps chromium` once; the browser needs system libraries.

## Hubs

- `package.json`: `dev:web` (`bun run --cwd apps/web dev`), `build:web` (`bun run --cwd apps/web build`), `test:e2e` (`playwright test`). The flag order matters: `bun --cwd apps/web next build` cannot find `next`, and `bun --cwd apps/web run build` prints help. Add `build:web` and `test:e2e` to `ci`. Extend `typecheck` with `&& bun run --cwd apps/web next typegen && tsc --noEmit -p apps/web/tsconfig.json`; the `PageProps` and `LayoutProps` globals do not exist until typegen or a build has run.
- `.eph`: `[web]` block with `run=bun run --cwd apps/web dev -- --port ${web.port}`, `role=app`, `port=auto`; `[env]` entry `WEB_URL=http://localhost:${web.port}` and, when the API is mounted, `<PREFIX>_API_URL=http://localhost:${web.port}`.
- `.oxlintrc.json`, `.oxfmtrc.json`, `.gitignore`: ignore `apps/web/.next/**` and `apps/web/next-env.d.ts`. Add an oxlint override for `apps/web/app/layout.tsx` turning off `import/no-unassigned-import` (the CSS import).
- `.github/workflows/ci.yml`: `bunx playwright install --with-deps chromium` before `bun run ci`.
- `AGENTS.md` check classification: "Web app: run the web tests and `bun run typecheck`. Run `bun run build:web` when routes, configuration, or dependencies change. Server-rendered behavior is covered by `test:e2e` in `ci`."
- Docker (release capability): the official Next `with-docker` layout. Builder installs with Bun and runs `bun run build:web`; the runtime stage is `node:22-alpine` (or the pinned Node major), copies `apps/web/.next/standalone/` to `/app`, then `apps/web/public` to `/app/apps/web/public` and `apps/web/.next/static` to `/app/apps/web/.next/static`, sets `HOSTNAME=0.0.0.0` and `PORT`, and runs `node apps/web/server.js` from `/app` as a non-root user. `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` is a build arg.

## What is not here

- A separate Vite SPA. When the interview says "browser only," this app is the whole product; when it says "other clients too," the API mounts here. A standalone SPA over the API is possible but no longer a default.
- Vercel-specific features: edge runtime, fluid compute, per-function timeouts, Vercel's image CDN. The standalone Node server serves images through `sharp`.
