# API server

Hono serves JSON over HTTP. Its route chain produces an `AppType` that `hc<AppType>` turns into a typed client, so every TypeScript caller (CLI, tests, other services) is checked against the routes at typecheck speed with no generated code.

Hono runs in two places, and the code is the same:

- **Standalone on Node**, when there is no web UI. `apps/server` starts it.
- **Mounted inside the Next.js app** (see [Web app](web-app.md)), when there is a UI and other clients too. The route file in `app/api/[[...route]]/route.ts` delegates to it. The browser does not use this API; it uses server actions and server components. Non-browser clients use this API.

Either way the Hono app lives in `libs/api` and is constructed with injected dependencies.

## Packages

- `libs/api`: `app.ts` exports `createApp(dependencies)` returning a Hono app with `basePath('/api')` and every route chained on it; `client.ts` exports `createClient(baseUrl, options)` wrapping `hc<AppType>` plus a typed error class; `index.ts` re-exports both and `type AppType`.
- `apps/server` (standalone only): thin entrypoint. Reads `HOST`, `PORT`, connection URLs from the environment, constructs dependencies, calls `createApp`, starts `@hono/node-server`. Handles `SIGINT` and `SIGTERM` by closing dependencies then the server.

## Dependencies

| Package               | Version | Where                                                           |
| --------------------- | ------- | --------------------------------------------------------------- |
| `hono`                | 4.13.2  | `libs/api`, and any workspace that imports it                   |
| `@hono/zod-validator` | 0.9.0   | `libs/api`                                                      |
| `zod`                 | 4.4.3   | `libs/api`                                                      |
| `@hono/node-server`   | 2.1.1   | `apps/server` only                                              |
| `@hono/zod-openapi`   | 1.6.0   | optional, only if a published OpenAPI document is a requirement |

Keep the `hono` version identical across workspaces; RPC types break across mismatched versions. Both client and server `tsconfig` need `strict: true` (the base already has it).

## Shape

- Chain routes on one instance or group with `.route()`. Type inference depends on chaining; separate `app.get(...)` statements lose it.

  ```ts
  const app = new Hono()
    .basePath('/api')
    .get('/health', (c) => c.json({ status: 'ok' as const, version: VERSION }, 200))
    .post('/v1/things', zValidator('json', CreateThing), async (c) => {
      const body = c.req.valid('json')
      const thing = await deps.things.create(body)
      return c.json(thing, 201)
    })
  export type AppType = typeof app
  ```

- Always pass an explicit status to `c.json(...)`. The client's response type is discriminated on it: `if (res.ok) { const data = await res.json() }` narrows to the 2xx shape, `res.status === 404` to that shape.
- Validate every input with `zValidator('json' | 'query' | 'param' | ...)`. Read it with `c.req.valid(target)`. Return `{ code, message }` for expected failures with a 4xx status.
- The client wraps `hc<AppType>(origin, { fetch, headers })`. Pass the **origin only** (`http://localhost:3000`); the inferred paths already include `/api`. Convert non-ok responses into a thrown typed error so callers never see Hono's `{ ok, status }` shape.
- Auth for non-browser clients is a bearer token checked in Hono middleware. Do not reuse the browser session.

## Tests

- Route tests: `app.request('/api/v1/things', { method: 'POST', body, headers })` with in-memory dependencies, under `bun test`. Or `testClient(app)` from `hono/testing` for typed calls.
- Client tests: build the client with `fetch: (input, init) => Promise.resolve(app.fetch(new Request(input, init)))` so route construction, serialization, and error conversion are covered without a port. The `Promise.resolve` matters: `app.fetch` and `app.request` return `Response | Promise<Response>`, which does not satisfy `typeof fetch`.
- `apps/server/src/main.test.ts`: environment parsing and wiring only.

## Hubs

- `package.json`: standalone only: `dev:server` (`bun --hot apps/server/src/main.ts`), `build:server` (`bun build apps/server/src/main.ts --target=node --outfile=dist/server.js`).
- `.eph`: standalone only: `[server]` block with `run=bun --hot apps/server/src/main.ts`, `role=app`, `port=auto`, `env.PORT=${server.port}`; `[env]` entry `<PREFIX>_API_URL=http://localhost:${server.port}`. Mounted: the Next dev server already serves `/api`; point `<PREFIX>_API_URL` at it.
- `AGENTS.md` check classification: "API contract: change the route chain in `libs/api`, then run the API tests and `bun run typecheck` so every `hc` caller is checked."
- `AGENTS.md` invariants: "Chain Hono routes; never call `app.get` as a statement. Pass an explicit status to every `c.json`. Only `libs/api` imports `hono`'s server side; callers import the client."

## Bastion reviewer

Add to `.bastion.yaml` with the API:

```yaml
reviewers:
  - name: api-contract
    trigger: ['libs/api/**']
    mode: gate
    backend: codex
    prompt: |
      Review changes to the Hono app and client in libs/api. Flag:
      1. A route added with a standalone `app.get(...)` statement rather
         than in the chain; the RPC client will not see it.
      2. A `c.json(...)` call without an explicit status; the client
         cannot discriminate the response type.
      3. A request body, query, or param read without `zValidator` on
         that target.
      4. A route that changes shape (path, params, body, response) with
         no corresponding change to the client facade or its test.
      5. A route or middleware that reads the browser session; this API
         serves non-browser clients and authenticates with a bearer token.
      Pass when none apply. Do not comment on naming or file layout.
```

## OpenAPI

Not needed for TypeScript callers. When a non-TypeScript client (iOS, another team) needs a document, add `@hono/zod-openapi`, which replaces `new Hono()` with `new OpenAPIHono()` and generates the document from the same Zod schemas. Serve it at `/api/openapi.json` and treat it as a runtime surface, not a checked-in artifact, until a consumer needs versioning.
