# Web UI

`apps/web` is the React entrypoint over the shared Eden contract. It consumes the server's `App` type through `TodoApiClient`, so API changes reach components at typecheck speed.

## Development

`eph dev` starts the Vite dev server alongside the API; open `$WEB_URL` after `eval "$(eph env)"`. Vite proxies `/api` to the eph-assigned server port and hot-reloads the UI, while the API reloads separately under `bun --hot`. In production the server serves `apps/web/dist` same-origin with an `index.html` fallback for client routes.

## State and structure

The invariants live in `AGENTS.md` under "Web UI invariants": TanStack Query for server state, typed URL search params for shareable state, `useActionState` with `useOptimistic` for forms and mutations, router context and providers instead of prop drilling, and route-level `errorComponent` and `pendingComponent`. The React Compiler owns memoization; a Nudge rule blocks `useMemo`, `useCallback`, and `memo`.

Each page is a file under `src/routes`; the route tree regenerates during dev and build. Feature code lives beside its route in a feature directory (`src/todos`), with pure view logic in plain modules that test without a DOM.

## Testing

Component tests run under `bun test` with happy-dom. They render against the real Elysia application backed by the in-memory repository through Eden's fetch boundary, so route handling, serialization, and error conversion are all real. Import the testing libraries from `src/testing.ts`, which registers the DOM before they load. Do not mock HTTP.

## Removal

The [customization guide](customizing.md) maps this capability's files and shared hubs. Remove the Web UI before or together with the HTTP API it consumes.
