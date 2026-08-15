# Capabilities

The base repository ships no application code. Each document in this directory describes one capability that a derived project can add: the packages, dependencies, shared-hub edits, invariants, and checks it needs. The `bootstrap` skill runs the interview that selects capabilities and applies these guides in dependency order.

Every guide was exercised in August 2026 by a throwaway project on the current base (pnpm 11, Node 26, Next 16.3, Hono 4.13, Postgres 18, pg-boss 12, Clerk Core 3, LogTape 2.3, napi 3, Bun 1.3 as compile target). The throwaway covered install, `check` from a fresh clone, standalone boot, the mounted API, server actions, a Playwright smoke test, migrations, transactional enqueue and a worker consuming it, structured logs with request ids, a Rust addon loaded on Node and inside a Bun-compiled CLI, and container images for the web app and the worker. Two things were not exercised: a real Clerk sign-in (no network) and cross-platform release builds. A second pass in August 2026 ran the `bootstrap` skill itself from a fresh clone with a fresh agent (web app with mounted API, Postgres, worker, Clerk, observability, release, per-project prod key); its corrections are folded into the guides. Still not exercised: a signed-in page, the Clerk webhook against a real signature, and multi-arch images. Nothing in the base verifies any guide afterward, so treat pinned versions as the last known-good set and confirm each against its registry before installing. When a guide proves wrong, fix the guide in the same changeset as the code.

## Order

Pick the backend shape first. The interview question is who calls it.

- Browser only: [Web app](web-app.md). Next.js owns pages, server components, and server actions. No separate API.
- Browser plus other clients (CLI, mobile, services, agents): [Web app](web-app.md) with the [API server](api-server.md) mounted inside it under `/api`. The browser uses server actions; everyone else uses the API.
- No browser: [API server](api-server.md) standalone on Node.

Then add the rest in this order. Each depends only on the ones before it.

1. [Environment](env.md): typed `process.env` decoding at boot. Every process needs it; apply it with the first surface.
2. [Web app](web-app.md) and/or [API server](api-server.md).
3. [CLI](cli.md): Incur command-line entrypoint, usually a client of the API.
4. [PostgreSQL](postgres.md): Drizzle schema, immutable migrations, worktree-local database.
5. [Worker](worker.md): pg-boss jobs in Postgres, executed by a separate Node process.
6. [Auth and billing](auth.md): Clerk sessions, organizations, machine tokens, and Stripe billing through Clerk.
7. [Observability](observability.md): LogTape logs, OpenTelemetry traces, Sentry errors.
8. [Rust and Node-API](rust-native.md): pure Rust crate behind a thin native adapter.
9. [Release](release.md): Git-tag versioning, standalone CLI binaries, container images.

## Shared hubs

Every capability touches some of these files. Edit each with the `mergeable-edits` discipline: append one entry, do not reorder.

After each guide, verify from a fresh clone: `git clone` to a scratch directory, `pnpm install --frozen-lockfile`, `pnpm run check`. The live checkout's link graph and generated files (Next's `next-env.d.ts`, `.next/types`) hide errors a clean machine hits.

| Hub                                          | What a capability adds                                                              |
| -------------------------------------------- | ----------------------------------------------------------------------------------- |
| `package.json`                               | workspace dependencies, scripts, `check` and `ci` steps                             |
| `pnpm-workspace.yaml`                        | `allowBuilds` entries for dependencies that run install scripts                     |
| `.github/workflows/ci.yml`                   | a job or step for the capability's authoritative check                              |
| `.eph`                                       | a service block or environment variables                                            |
| `.gitignore`                                 | an exception for a new repository skill under `.agents/skills` and `.claude/skills` |
| `.nudge.yaml`                                | deterministic rules, each with fixtures in `tests/fixtures/nudge`                   |
| `.bastion.yaml`                              | a single-concern reviewer when a semantic invariant needs judgment                  |
| `AGENTS.md`                                  | one line in the check classification and any new invariants                         |
| `.oxlintrc.json`, `.oxfmtrc.json`, `.ignore` | ignore patterns for generated files                                                 |
| `tools/doctor.ts`                            | a probe for a new required tool                                                     |
| `vitest.config.ts`                           | a project for tests that need an environment or a service                           |
| `secrets/<env>.env`                          | every secret the capability's env schema requires (`pnpm secrets set`)              |
