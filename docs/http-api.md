# HTTP API

`libs/api/src/server.ts` owns the Elysia route factory and exports its complete `App` type. `libs/api/src/client.ts` passes that type to Eden Treaty, so route, parameter, body, response, and status changes reach the CLI through ordinary TypeScript checking without generated files.

The compiled CLI still makes HTTP requests and contains no server implementation. Its source build depends on the current server type, which is appropriate while the client and server share this Bun and TypeScript monorepo. If they become independently versioned, or a non-TypeScript consumer appears, add a language-neutral contract and compatibility policy as one complete capability.

The Elysia OpenAPI plugin remains a runtime documentation surface. A running server exposes the UI at `/openapi` and the raw document at `/openapi/json`; neither endpoint is a checked-in build artifact.

When an endpoint changes, update its Elysia schema and any affected `TodoApiClient` facade method, then run the API tests and `bun run typecheck`. The client test uses the real Elysia handler through Eden's fetch boundary, so it covers route construction, serialization, response typing, and error conversion without opening a port.
