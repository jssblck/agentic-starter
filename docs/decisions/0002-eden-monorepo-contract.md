# ADR 0002: Eden is the CLI/server contract

Status: accepted

`libs/api` exports the Elysia application's complete `App` type. The CLI passes that type to Eden Treaty, so route, parameter, body, response, and status changes reach callers through ordinary TypeScript checking. The compiled CLI contains no server implementation and still communicates with the server over HTTP.

This is a source-level contract for a Bun and TypeScript monorepo. The repository has no generated API client, committed OpenAPI artifact, or regeneration gate. Elysia's OpenAPI document remains a runtime documentation surface for people and external tools.

If the client and server become independently versioned, or a non-TypeScript consumer appears, replace this decision with a language-neutral contract and an explicit compatibility policy.
