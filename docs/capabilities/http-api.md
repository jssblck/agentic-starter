# HTTP API

Elysia serves the API. Its exported `App` type feeds Eden Treaty, so every TypeScript caller (CLI, web, tests) is checked against the routes at typecheck speed with no generated client.

## Packages

- `libs/api`: the dependency-injected Elysia factory (`server.ts`) and the Eden client facade (`client.ts`). Export both from `index.ts` and expose `./server` as a second package entry so the app can import the factory without pulling the client.
- `apps/server`: thin entrypoint. Incur parses `HOST`, `PORT`, `LOG_LEVEL`, and any connection URLs from the environment, constructs dependencies, calls `createApp`, and listens. Handle `SIGINT` and `SIGTERM` by closing dependencies then the server.

## Dependencies

| Package           | Version | Where                                                                                      |
| ----------------- | ------- | ------------------------------------------------------------------------------------------ |
| `elysia`          | 1.4.29  | `libs/api`, `apps/server` (declare in both; the isolated linker hides transitive packages) |
| `@elysia/eden`    | 1.4.10  | `libs/api`                                                                                 |
| `@elysia/openapi` | 1.4.15  | `libs/api`, only if a runtime reference page is wanted                                     |
| `incur`           | 0.4.17  | `apps/server`                                                                              |

## Shape

- Mount everything under `/api` so a web UI can be served same-origin later without route collisions.
- Define request and response schemas with Elysia's `t` in the route options. Use `$id` on shared schemas so OpenAPI names them.
- `createApp(dependencies)` takes an interface of repositories and services. Tests pass in-memory implementations.
- `export type App = ReturnType<typeof createApp>`.
- The client class wraps `treaty<App>(baseUrl, { fetcher })`. Convert Eden's `{ data, error, status }` into a thrown typed error class or the unwrapped data; do not leak Eden's shape past `libs/api`.
- Return `status(4xx, { code, message })` from handlers for expected failures and declare those response schemas.

## Tests

- `libs/api/src/server.test.ts`: call `app.handle(new Request(...))` with in-memory dependencies.
- `libs/api/src/client.test.ts`: build the client with a `fetch` that delegates to `app.handle`. This covers route construction, serialization, response typing, and error conversion without opening a port.
- `apps/server/src/main.test.ts`: only environment parsing and dependency wiring.

## Hubs

- `package.json`: add `dev:server` (`bun --hot apps/server/src/main.ts`) and `build:server` (`bun build apps/server/src/main.ts --target=bun --minify --outfile=dist/server.js`).
- `.eph`: add a `[server]` block with `run=bun --hot apps/server/src/main.ts`, `role=app`, `port=auto`, `env.PORT=${server.port}`, and an `[env]` entry `API_URL=http://localhost:${server.port}` (rename the prefix for the project). Add `roles_order=dep,app` if the file does not have it.
- `AGENTS.md` check classification: "API contract: update the Elysia schemas in `libs/api`, then run the API tests and `bun run typecheck` so Eden callers are checked against the new route type."
- `AGENTS.md` invariants: "Only `apps/server` may start the Elysia HTTP surface."

## When the contract must be language-neutral

The inferred `App` type is right while client and server are versioned together in one TypeScript monorepo. When a non-TypeScript consumer appears or the client ships independently, add OpenAPI export as a checked build artifact and a compatibility policy as one complete capability. Until then, `@elysia/openapi` is a runtime documentation surface only.
