# ADR 0002: OpenAPI is the CLI/server contract

Status: accepted

The CLI consumes types generated from the server's OpenAPI document rather than importing Elysia's application type. This creates a real network compatibility boundary, keeps the CLI independently distributable, and makes non-TypeScript consumers possible.

The cost is committed generated code and an explicit regeneration gate. That cost is preferable to silently coupling a released CLI to monorepo source types.
