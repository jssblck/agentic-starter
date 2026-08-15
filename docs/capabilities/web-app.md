# Web app

Next.js App Router is the default when the product has a browser UI. It owns the pages, server components, server actions, and the browser's private data path. When other clients exist (CLI, mobile, services, agents), the [API server](api-server.md) mounts inside the same Next app under `/api` and those clients use it; the browser does not.

Self-hosted on Node (Railway, a Docker host). Nothing here depends on Vercel.

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

| Package                               | Version | Where                                                                  |
| ------------------------------------- | ------- | ---------------------------------------------------------------------- |
| `next`                                | 16.3.1  | deps                                                                   |
| `react`, `react-dom`                  | 19.2.8  | deps (App Router bundles its own React canary; the pin is for tooling) |
| `@base-ui/react`                      | 1.7.0   | deps                                                                   |
| `@tanstack/react-query`               | 5.101.4 | deps, client-side server state only                                    |
| `clsx`                                | 2.1.1   | deps                                                                   |
| `tailwind-merge`                      | 3.6.0   | deps                                                                   |
| `class-variance-authority`            | 0.7.1   | deps (idle since 2024, still what shadcn generates)                    |
| `sharp`                               | 0.35.3  | deps, image optimization when self-hosting                             |
| `tailwindcss`, `@tailwindcss/postcss` | 4.3.3   | dev                                                                    |
| `@types/react`                        | 19.2.18 | dev                                                                    |
| `@types/react-dom`                    | 19.2.4  | dev                                                                    |
| `@playwright/test`                    | 1.62.1  | root dev, for the smoke test                                           |
| `shadcn`                              | 4.18.0  | run with `bunx`, not installed                                         |

Bun installs and runs tests; Node runs production. Next requires Node 20.9+.

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
- Server components, server actions, and routing: one Playwright smoke test in `tests/e2e` that builds, starts `node .next/standalone/server.js`, and walks the main flows. It runs in `ci`, not `check`.

## Hubs

- `package.json`: `dev:web` (`bun --cwd apps/web next dev`), `build:web` (`bun --cwd apps/web next build`), `test:e2e` (`bunx playwright test`). Add `build:web` and `test:e2e` to `ci`. Extend `typecheck` with `&& tsc --noEmit -p apps/web/tsconfig.json`; the root `tsconfig.json` excludes `apps/web/**`.
- `.eph`: `[web]` block with `run=bun --cwd apps/web next dev --port ${web.port}`, `role=app`, `port=auto`; `[env]` entry `WEB_URL=http://localhost:${web.port}` and, when the API is mounted, `<PREFIX>_API_URL=http://localhost:${web.port}`.
- `.oxlintrc.json`, `.oxfmtrc.json`, `.gitignore`: ignore `apps/web/.next/**` and `apps/web/next-env.d.ts`.
- `.github/workflows/ci.yml`: `bunx playwright install --with-deps chromium` before `bun run ci`.
- `AGENTS.md` check classification: "Web app: run the web tests and `bun run typecheck`. Run `bun run build:web` when routes, configuration, or dependencies change. Server-rendered behavior is covered by `test:e2e` in `ci`."
- Docker (release capability): the official Next `with-docker` layout. Builder installs with Bun and runs `bun run build:web`; the runtime stage is `node:22-alpine` (or the pinned Node major), copies `apps/web/public`, `.next/standalone`, and `.next/static`, sets `HOSTNAME=0.0.0.0` and `PORT`, and runs `node apps/web/server.js` as a non-root user. `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` is a build arg.

## What is not here

- A separate Vite SPA. When the interview says "browser only," this app is the whole product; when it says "other clients too," the API mounts here. A standalone SPA over the API is possible but no longer a default.
- Vercel-specific features: edge runtime, fluid compute, per-function timeouts, Vercel's image CDN. The standalone Node server serves images through `sharp`.
