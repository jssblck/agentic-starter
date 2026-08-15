# Web app

Next.js App Router is the default when the product has a browser UI. It owns the pages, server components, server actions, and the browser's private data path. When other clients exist (CLI, mobile, services, agents), the [API server](api-server.md) mounts inside the same Next app under `/api` and those clients use it; the browser does not.

Self-hosted on Node (Railway, a Docker host). Nothing here depends on Vercel.

## Scaffold

Run once, from the repository root:

```sh
mkdir -p apps
pnpm dlx create-next-app@latest apps/web --ts --app --tailwind --no-eslint --no-src-dir --import-alias "@/*" --use-pnpm --skip-install --turbopack --yes
rm apps/web/README.md apps/web/CLAUDE.md apps/web/pnpm-workspace.yaml
```

`apps/` must exist first; otherwise the CLI reports "application path is not writable". It writes a nested `pnpm-workspace.yaml` (delete it, but move its `allowBuilds` entries for `sharp` and `unrs-resolver` into the root file, with `sharp: true`) and a `packageManager` field (delete it).

Then replace what it wrote: `apps/web/package.json` (name, exact pins from the table below, no `ignoreScripts`), `apps/web/tsconfig.json` (extend the root and keep the Next plugin, see below), `next.config.ts` (see Configuration). Keep its `.gitignore` or fold the entries into the root one; it ignores `next-env.d.ts`, which Next 16 regenerates. Keep `apps/web/AGENTS.md`: `next dev` rewrites it on every run with a block that points agents at `node_modules/next/dist/docs`, and committing it is the only way to keep the tree clean.

Then the UI kit:

```sh
cd apps/web && pnpm dlx shadcn@latest init -b base -p nova --no-monorepo --no-pointer -y
pnpm dlx shadcn@latest add button input textarea dialog
```

`-p` is required; without a preset the CLI prompts and an agent hangs. Do not pass `-t`; that creates a new project. `init` adds `shadcn`, `lucide-react`, and `tw-animate-css` as runtime dependencies (its `globals.css` imports `shadcn/tailwind.css`) with caret ranges, ignoring `save-exact`; pin them. Run `pnpm run fmt` afterward.

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

Next requires Node 20.9+; the base pins 24 or later. `pnpm-workspace.yaml` `allowBuilds`: `sharp: true`, `unrs-resolver: false`.

`apps/web/tsconfig.json` extends the root, sets `jsx: "preserve"`, `allowJs`, `incremental`, `plugins: [{ name: "next" }]`, `paths: { "@/*": ["./*"] }`, and includes `next-env.d.ts`, `**/*.ts`, `**/*.tsx`, `.next/types/**/*.ts`. The root `tsconfig.json` excludes `apps/web/**`.

## Configuration

`next.config.ts`:

```ts
const config: NextConfig = {
  output: 'standalone',
  cacheComponents: true,
  outputFileTracingIncludes: {
    // Standalone tracing misses two things under the isolated linker: sharp's
    // native binaries and @swc/helpers/esm (the server boots to "Cannot find
    // module .../@swc/helpers/esm/_interop_require_default.js" without it).
    '/*': [
      'node_modules/sharp/**/*',
      '../../node_modules/.pnpm/@swc+helpers*/node_modules/@swc/helpers/esm/**/*',
    ],
  },
  experimental: { serverActions: { allowedOrigins: [/* public hostnames behind the proxy */] } },
  async headers() {
    return [{ source: '/api/:path*', headers: [{ key: 'X-Accel-Buffering', value: 'no' }] }]
  },
}
```

- `cacheComponents: true` turns on partial prerendering and makes everything dynamic unless a function or component says `"use cache"`. The per-route `dynamic`, `revalidate`, and `fetchCache` exports do not exist in this mode; agents reach for them from older training data. Cache with `"use cache"` plus `cacheLife()` and `cacheTag()`.
- A page is prerendered static at build unless Next sees something dynamic in it (`cookies()`, `headers()`, `searchParams`, an uncached `fetch`). A page that reads a repository or database directly looks static and will never reflect writes. Put `await connection()` (from `next/server`) in the component that reads the data, and put that component under a `<Suspense>` boundary. The page itself stays synchronous and renders the shell. The build summary marks such pages `◐`; a `○` next to a data page is the bug.
- Everything request-bound (`connection()`, `params`, `searchParams`, `cookies()`, `headers()`, `auth()`, Clerk's `<Show>` and `<UserButton>`) must sit under `<Suspense>`. Reading it in the page body fails the build with "uncached or runtime data during prerendering" (`blocking-prerender-dynamic`). The escape hatch is `export const instant = false` on the page, which allows a blocking route; use it only while migrating.
- `NEXT_PUBLIC_*` values are inlined into client bundles when read with a literal key. `process.env['NEXT_PUBLIC_X']` (which `noPropertyAccessFromIndexSignature` requires) is inlined the same as dot access. A computed key is not.
- `instrumentation.ts` `register()` that throws (env validation, sink setup) does not stop the server; it keeps running and answers 500 on every request. Fail fast elsewhere: the container entrypoint runs `node apps/web/env-check.js` (a two-line script that imports the env module) before `server.js`, and the health check must not be exempt from that failure.
- Server components, server actions, and route handlers are separate server bundles. A module-level value in `lib/` is created once per bundle, so in-memory state is not shared between a page and the mounted API. Treat that as the design, not an obstacle: every process-local shortcut it blocks would also break the first horizontal scale-out. Construct clients (database, queue, cache) in `lib/`; keep no state there.
- `notFound()` inside a partially prerendered page streams the 404 body under HTTP 200. That is by design; check the rendered text, not the status, when verifying.
- `proxy.ts` replaced `middleware.ts` in Next 16 and runs on Node. Do not create `middleware.ts`.
- `runtime = 'edge'` is deprecated and `maxDuration` does nothing off Vercel. Do not add either.
- Streaming (SSE from a route handler, streaming SSR) works on Node. `X-Accel-Buffering: no` stops nginx-style proxies from buffering. Compression layers can still buffer; check the deployment.
- Multi-instance (replicas, rolling deploys): set `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` at build on every instance, or actions fail across instances. The default cache is per instance; configure `cacheHandler` (the Redis example in the Next repo) only when a second replica exists.

## Styling and components

Tailwind 4 with no config file: `postcss.config.mjs` contains `{ plugins: { '@tailwindcss/postcss': {} } }`, and `app/globals.css` starts with `@import 'tailwindcss'` followed by `@theme { ... }` tokens. Import it from the root layout.

Base UI provides headless primitives. `pnpm dlx shadcn@latest init -b base` generates the kit into `components/ui` on Base UI and Tailwind; add components with `pnpm dlx shadcn@latest add <name>`. After copy the files are yours: edit them, do not re-generate over edits.

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

## Bastion reviewers

The rules below are semantic; Nudge cannot express them. Add them to `.bastion.yaml` when the web app lands, commented out like the base defaults, and uncomment each one when the project decides to pay for it. Each is scoped to the paths it governs so it does not run on unrelated changes, and each is one concern.

```yaml
reviewers:
  - name: web-rendering-semantics
    trigger: ['apps/web/app/**']
    mode: gate
    backend: codex
    prompt: |
      Review changed files under apps/web/app for Next.js Cache Components
      semantics. Flag only these three cases, with the file and line:
      1. A page or layout that reads a repository, database, or store and
         does not call `await connection()` (from next/server), read
         `cookies()`/`headers()`/`searchParams`, or perform an uncached
         fetch. It will be prerendered static and never reflect writes.
      2. A page or route handler that exports `dynamic`, `revalidate`,
         `fetchCache`, `runtime`, or `maxDuration`. These do nothing or
         are removed in this mode.
      3. A new `middleware.ts`. Next 16 uses `proxy.ts`.
      Pass when none apply. Do not comment on style or structure.

  - name: web-client-boundary
    trigger: ['apps/web/app/**', 'apps/web/components/**']
    mode: gate
    backend: codex
    prompt: |
      Review changed React files for the server/client boundary. Flag:
      1. A file with "use client" whose component uses no state, effect,
         event handler, browser API, or client-only library; it should be
         a server component.
      2. A "use client" component that imports a server-only module
         (database client, secrets, node: builtins) or a module from
         apps/web/lib that constructs one.
      3. A server component that passes a function or class instance
         (not a server action) as a prop to a client component.
      4. Data fetched in useEffect or on mount that a server component
         or server action could have provided.
      Pass when none apply. Do not review styling.

  - name: web-shared-core
    trigger: ['apps/web/app/**', 'apps/web/lib/**', 'libs/api/**']
    mode: gate
    backend: codex
    prompt: |
      The browser reaches data through server actions and server
      components; other clients reach it through the Hono app in libs/api.
      Both must call the same functions in libs. Flag:
      1. A server action or route handler that implements a workflow
         (validation beyond parsing input, persistence, or business rules)
         inline instead of calling a libs function.
      2. A feature added to one surface (a server action, or a Hono route)
         with no corresponding path on the other, when the feature is one
         a non-browser client would plausibly need. Ask, do not assume.
      3. Module-level mutable state in apps/web/lib. Server bundles do not
         share it and replicas never will.
      Pass when none apply.
```

The [API server](api-server.md) guide adds one more for the route chain. Together with the two commented defaults in the base `.bastion.yaml` (correctness, simplicity), that is five reviewers; do not add more until one of these produces a finding you could not have caught otherwise.

## Tests

- `libs` and the mounted Hono app: Vitest, in-process, no port.
- Client components: Vitest with happy-dom (`environment: "happy-dom"` on a `web` project in `vitest.config.ts`), rendering the component with its props. Do not render server components this way; Next documents that async server components are not unit-testable in Vitest or Jest either.
- Server components, server actions, and routing: one Playwright smoke test in `tests/e2e` against the built standalone server. `playwright.config.ts` at the root uses `webServer` with the copy step and `node apps/web/.next/standalone/apps/web/server.js` (a monorepo standalone nests under `apps/web`), `url` pointing at `/api/health`, and the environment the server needs (`PORT`, `HOSTNAME=127.0.0.1`, `DATABASE_URL`). It runs in `ci`, not `check`. Locally, run `pnpm dlx playwright install --with-deps chromium` once; the browser needs system libraries. Once auth is installed the smoke test needs real Clerk test keys; see [Auth](auth.md).

## Hubs

- `package.json`: `typegen` (`pnpm --filter @scope/web exec next typegen`), `dev:web` (`pnpm --filter @scope/web dev`), `build:web` (`pnpm --filter @scope/web build`), `test:e2e` (`playwright test`). Put `pnpm run typegen &&` at the front of `check`: the `PageProps` and `LayoutProps` globals and `next-env.d.ts` do not exist on a fresh clone until typegen runs, and type-aware lint fails on them before typecheck would. Extend `typecheck` with `&& tsc --noEmit -p apps/web/tsconfig.json`. Add `build:web` and `test:e2e` to `ci`. Set `SKIP_ENV_VALIDATION=1` on `typegen` and `build:web` when the env module has server variables without defaults; `next build` evaluates route modules that import it (see [Environment](env.md)).
- `.eph`: `[web]` block with `run=sh -c 'cd apps/web && exec node_modules/.bin/next dev'`, `role=app`, `port=auto`, `env.PORT=${web.port}`. eph interpolates `${web.port}` only in `env.*` and top-level variables, not in `run=`; `next dev` reads `PORT`. The `exec` form matters: `run=pnpm --filter ... dev` leaves `next-server` alive after `eph down` and the next `eph up` fails on "existing server". Do not put `${web.port}` in a top-level `[env]` variable: `eph env` refuses to resolve while the app is down, which breaks `eph up --role dep`. Clients read the URL from `eph status` after `eph up`.
- `.oxlintrc.json`, `.oxfmtrc.json`, `.gitignore`: ignore `apps/web/.next/**` and `apps/web/next-env.d.ts`. Add an oxlint override for `apps/web/app/layout.tsx` turning off `import/no-unassigned-import` (the CSS import).
- `pnpm-workspace.yaml`: `allowBuilds` entries `sharp: true`, `unrs-resolver: false`.
- `.github/workflows/ci.yml`: `pnpm dlx playwright install --with-deps chromium` before `pnpm run ci`.
- `AGENTS.md` check classification: "Web app: run the web tests and `pnpm run typecheck`. Run `pnpm run build:web` when routes, configuration, or dependencies change. Server-rendered behavior is covered by `test:e2e` in `ci`."
- Docker (release capability): the official Next `with-docker` layout. Builder copies `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `package.json`, `.npmrc`, the root `tsconfig.json` (the app's `tsconfig` extends it; Turbopack fails without it), `apps`, and `libs`, then `corepack enable && pnpm install --frozen-lockfile` and `SKIP_ENV_VALIDATION=1 pnpm run build:web` with `NEXT_PUBLIC_*` values as build args; the runtime stage is `node:24-alpine` (or the pinned Node major), copies `apps/web/.next/standalone/` to `/app`, then `apps/web/public` to `/app/apps/web/public` and `apps/web/.next/static` to `/app/apps/web/.next/static`, sets `HOSTNAME=0.0.0.0` and `PORT`, and runs `node apps/web/server.js` from `/app` as a non-root user. `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` is a build arg.

## What is not here

- A separate Vite SPA. When the interview says "browser only," this app is the whole product; when it says "other clients too," the API mounts here. A standalone SPA over the API is possible but no longer a default.
- Vercel-specific features: edge runtime, fluid compute, per-function timeouts, Vercel's image CDN. The standalone Node server serves images through `sharp`.
