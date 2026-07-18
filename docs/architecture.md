# Architecture

## Design objective

The primary optimization target is guardrails per second across several speculative worktrees. The repository keeps high-churn product logic in TypeScript, retains Rust for a narrow capability where its guarantees matter, and prevents ordinary TypeScript edits from rebuilding the native graph.

Bun and TypeScript are the permanent control plane for projects derived from this starter. The Rust, native, database, HTTP, CLI, worktree-service, and release layers are worked examples that an agent may remove as complete capability units.

## Dependency direction

```text
bins/cli -------> libs/api (Eden client) -------> HTTP API
   |
   +-----------> libs/native -------> todo-parser-napi -------> todo-parser

bins/server ----> libs/api (Elysia factory)
   |
   +-----------> libs/db ----------> PostgreSQL
   +-----------> libs/native -------> todo-parser-napi -------> todo-parser
   +-----------> libs/version

libs/api + libs/db + libs/native + bins ----> libs/domain (shared todo types)
```

The diagram shows the example instance of the permanent shape. The rules below are the permanent invariants; the todo package names that express them belong to the example and are renamed or deleted with their capabilities.

Rules:

1. `todo-parser` is pure Rust. It has no Bun, Node-API, HTTP, or database concerns.
2. `todo-parser-napi` translates errors and serialization. It contains no domain parsing logic.
3. `bins` contain executable boundaries only: Incur command and environment schemas, dependency construction, library calls, and process-oriented output. Incur parses process input and formats command results; only TODO text crosses into the Rust parser.
4. `libs/api` owns the dependency-injected Elysia factory and its Eden client facade. The exported `App` type keeps their HTTP calls aligned without code generation.
5. `libs/native` is the only TypeScript package that loads `.node` code. Its output decoder treats the addon as untrusted.
6. `libs/db` owns Drizzle and raw database access. Applications depend on `TodoRepository`.
7. `libs/version` supplies one build identity to every TypeScript surface; Rust receives the same identity through its build script.
8. `libs/domain` owns the shared domain types and their type guards. Every application package may depend on it; it depends only on `libs/version`.

## HTTP and native boundaries

The CLI and server share an inferred Elysia contract at build time, but the compiled CLI still crosses a real HTTP boundary through Eden Treaty. Runtime OpenAPI remains available for people and tools that need to inspect a running server.

The client CLI also retains Incur's Fetch surface for agents and HTTP consumers. `todoctl serve` starts it explicitly on an assigned port. The executable entry module does not default-export the Incur object because Bun treats any entrypoint default export with a `fetch` handler as a server and starts it automatically. `todo-server` exposes only the Elysia HTTP application.

The Node-API addon is a same-process optimization boundary. It is suitable for parsing, indexing, compression, or other CPU-heavy operations. Keep calls coarse enough that native work dominates crossing overhead. For a real parser, export batch operations or byte-buffer APIs rather than one call per token.

## Testing layers

- Rust unit tests prove parser semantics without Bun.
- Native decoder tests prove TypeScript rejects malformed addon output without compiling Rust.
- Elysia application tests inject an in-memory repository and parser.
- Eden client tests exercise the real Elysia handler through a fetch boundary.
- Database integration tests exercise Drizzle against Postgres.
- CI's smoke test runs the built native addon, server, database, Eden client, and CLI together.

This arrangement makes most tests cheap and keeps the expensive boundary test authoritative.
