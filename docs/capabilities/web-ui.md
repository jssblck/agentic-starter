# Web UI

React over the same Eden contract the CLI uses. A route or schema change reaches components at typecheck speed. Vite serves development with hot module replacement; the server serves the built assets same-origin in production.

Requires the [HTTP API](http-api.md).

## Packages

- `apps/web`: Vite project. `index.html`, `src/main.tsx` (creates the API client from `location.origin`, the query client, the router), `src/router.tsx` (router context type, `createWebRouter`, `createWebQueryClient`, the `Register` module augmentation), `src/routes/__root.tsx` (providers, layout, default `errorComponent` and `pendingComponent`), `src/routes/*.tsx` (one file per page), feature directories beside their routes (`src/<feature>/`), `src/testing.ts`, `src/app.css`, `vite.config.ts`, `tsconfig.json`.
- `apps/server/src/web.ts`: serves `apps/web/dist` when it exists. Unknown non-API paths fall back to `index.html`; `/api` paths still return 404 so a missing route fails loudly. Reject paths that resolve outside the dist root.

## Dependencies

| Package                            | Version    | Where                     |
| ---------------------------------- | ---------- | ------------------------- |
| `react`, `react-dom`               | 19.2.7     | deps                      |
| `@tanstack/react-router`           | 1.170.18   | deps                      |
| `@tanstack/react-query`            | 5.101.0    | deps                      |
| `@base-ui-components/react`        | 1.0.0-rc.0 | deps, headless primitives |
| `vite`                             | 8.0.16     | dev                       |
| `@vitejs/plugin-react`             | 6.0.2      | dev                       |
| `@tanstack/router-plugin`          | 1.168.22   | dev                       |
| `@rolldown/plugin-babel`           | ^0.2.3     | dev                       |
| `@babel/core`                      | ^8.0.1     | dev                       |
| `babel-plugin-react-compiler`      | 1.0.0      | dev                       |
| `tailwindcss`, `@tailwindcss/vite` | 4.3.1      | dev                       |
| `@happy-dom/global-registrator`    | 20.10.6    | dev                       |
| `@testing-library/react`           | 16.3.2     | dev                       |
| `@testing-library/user-event`      | 14.6.1     | dev                       |
| `@types/react`                     | 19.2.17    | dev                       |
| `@types/react-dom`                 | 19.2.3     | dev                       |
| `@types/babel__core`               | ^7.20.5    | dev                       |

## Configuration

`vite.config.ts` plugins in order: `tanstackRouter({ target: 'react' })`, `react()`, `babel({ presets: [reactCompilerPreset()] })`, `tailwindcss()`. Server: `host: '127.0.0.1'`, `port` from `PORT` with `strictPort` when set, and `proxy: { '/api': { changeOrigin: true, target } }` where `target` is the origin of `<PREFIX>_API_URL`.

`apps/web/tsconfig.json` extends the root, sets `jsx: 'react-jsx'`, `types: ['bun', 'vite/client']`, and includes `src/**/*.ts`, `src/**/*.tsx`, `vite.config.ts`. The root `tsconfig.json` excludes `apps/web/**`; the root `typecheck` script runs both projects.

## Invariants (add to `AGENTS.md`)

- Server state lives in TanStack Query through the shared API client. Components never fetch in effects.
- Reach for `useState` last: shareable state belongs in typed URL search params, form and mutation state in `useActionState` with `useOptimistic`, cross-cutting dependencies in router context and providers.
- The React Compiler owns memoization. Do not use `useMemo`, `useCallback`, or `memo`.
- Every route defines or inherits `errorComponent` and `pendingComponent`.
- Component tests render against the real Elysia app over Eden's fetch boundary with in-memory repositories. Do not mock HTTP.

## Tests

`src/testing.ts` registers happy-dom then dynamically imports the testing libraries, because Bun initializes CommonJS imports before any ESM module body runs and a static import would bind `document.body` before the DOM exists. Tests build the API client with a `fetch` that delegates to `app.handle`, exactly as the Eden client test does. Pure view logic goes in plain modules that test without a DOM.

## Generated file

The router plugin writes `src/routeTree.gen.ts` with `@ts-nocheck` and `as any` by design. Commit it and exclude it from `nudge check` (root `.ignore`), oxlint, and oxfmt (`ignorePatterns` in both configs). Nudge's `file:` glob accepts one positive pattern, so per-rule exclusion is not expressible; the `.ignore` file is the mechanism.

## Hubs

- `package.json`: `dev:web` (`bun --cwd apps/web dev`), `build:web` (`bun --cwd apps/web build`), extend `typecheck` with `&& tsc --noEmit -p apps/web/tsconfig.json`. Add `build:web` to `ci`.
- `.eph`: `[web]` block with `run=bun --cwd apps/web dev`, `role=app`, `port=auto`, `env.PORT=${web.port}`; `[env]` entry `WEB_URL=http://localhost:${web.port}`.
- `.nudge.yaml`: `react-no-manual-memoization` on `**/*.tsx` with regex `\b(?:useMemo|useCallback|memo)\s*\(`; add fixtures.
- `.oxlintrc.json`: an override for `apps/web/src/main.tsx` turning off `import/no-unassigned-import` (the CSS import).
- `.github/workflows/ci.yml`: `bun run build:web` in the TypeScript job.
- `AGENTS.md` check classification: "Web UI: run the web tests and `bun run typecheck`. Run `bun run build:web` when routes, configuration, or dependencies change."
- Docker (release capability): a `web-builder` stage that runs `bun run build:web` and a `COPY --from` of `apps/web/dist` into the runtime image.
