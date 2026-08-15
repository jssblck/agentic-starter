# Agent directives

This repository is optimized for several coding agents working in separate Git worktrees. Preserve that property while changing it.

## Read first

1. Read `docs/architecture.md` and the nearest domain document before editing.
2. Run `bun run doctor` to see which local tools are available.
3. Run `eph up` only when the task needs the local service stack. Every worktree gets isolated Postgres data and ports.
4. Run `bun run native:ensure` only when a real native integration test or executable needs the Rust addon.

## Classify the change before running checks

- TypeScript-only: run `bun run fmt:check`, `bun run lint`, `bun run typecheck`, and focused Bun tests. Do not invoke Cargo.
- Rust core: run focused `cargo check --locked -p todo-parser` and `cargo test --locked -p todo-parser`; materialize the addon only for boundary tests.
- Native boundary: run both Rust checks and `bun run native:ensure`, then the native package tests.
- API contract: update the Elysia schemas in `libs/api`, then run the API tests and TypeScript checks so Eden callers are checked against the new route type.
- Database schema: edit `libs/db/src/schema.ts`, run `bun run db:generate`, inspect the SQL, and add migration tests. Never edit a migration that may already have shipped.
- Web UI: run the web tests and `bun run typecheck`. Run `bun run build:web` when routes, configuration, or dependencies change.
- Release/tooling: run `bun run version:check` and `bun run release:check`.

Run the full `bun run check` when the changeset is coherent, not after every small edit.

## TypeScript invariants

- Keep `apps` as thin entrypoints: parse inputs from the surface they own (process, HTTP, DOM), construct dependencies, invoke `libs`, and render output back to that surface. Business logic and testable workflows belong in dependency-injected libraries.
- Do not introduce `any`, TypeScript suppression comments, non-null assertions, or double assertions.
- Treat all external data as `unknown` until a boundary decoder proves its shape.
- Represent finite states with tagged unions and handle them exhaustively.
- Define commands, options, environment variables, help, and version handling with Incur in `apps`. Only TODO text crosses into the Rust parser.
- Keep Incur definitions in `cli.ts` and executable entrypoints in `main.ts`. A Bun entrypoint that default-exports an Incur CLI auto-starts its Fetch server; only `todoctl serve` may start that surface, while `todo-server` serves HTTP through Elysia.
- Keep raw SQL and Drizzle access inside `libs/db`.
- Keep direct `.node` loading inside `libs/native/src/load.ts`; the rest of the code depends on `TodoParser`.
- Generated files are outputs. Change their source and regenerate them.

## Web UI invariants

- Server state lives in TanStack Query through the shared API client. Components never fetch in effects.
- Reach for `useState` last: shareable state belongs in typed URL search params, form and mutation state in `useActionState` with `useOptimistic`, and cross-cutting dependencies in router context and providers rather than prop drilling.
- The React Compiler owns memoization. Do not use `useMemo`, `useCallback`, or `memo`.
- Every route defines or inherits `errorComponent` and `pendingComponent`; failures render boundaries, not blank screens.
- Component tests render against the real Elysia app over Eden's fetch boundary with the in-memory repository. Do not mock HTTP.

## Rust invariants

- `todo-parser` is a pure library with no Node or database dependency.
- `todo-parser-napi` is a thin adapter. Domain logic belongs in `todo-parser`.
- Do not use `unwrap`; return an error or use `expect` only for a documented invariant.
- Keep the Node-API surface coarse-grained. Prefer batches or buffers for real hot paths.

## Agent feedback loops

Nudge catches deterministic violations before writes and in CI. Bastion reviews semantic invariants after a coherent changeset exists. Do not move a deterministic rule into an agent reviewer merely because it is easier to write as prose. Reviewers are single-concern: address blocking findings within a reviewer's scope, and when a reviewer drifts into style or unrelated design, refine its prompt rather than accumulating exceptions in application code.

Before opening a pull request:

```sh
bun run check
bastion review --base main
```

When a debugging incident yields a durable repository-specific lesson, record it with `nudge learn add` and include the problem, fix, and verification. Do not store generic language advice or temporary task state.

## Customizing the starter

Use the `customize-starter` skill. Do not begin with a repository-wide search-and-replace: package scopes, binary names, environment prefixes, release artifact names, and prose have different grammatical forms.

Bun, TypeScript, the root check command, and the agent-policy layer are the permanent base. Delete other capabilities only as complete units using `docs/customizing.md`.
