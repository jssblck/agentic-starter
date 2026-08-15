# Capabilities

The base repository ships no application code. Each document in this directory describes one capability that a derived project can add: the packages, dependencies, shared-hub edits, invariants, and checks it needs. The `bootstrap` skill runs the interview that selects capabilities and applies these guides in dependency order.

These guides were written from a working implementation that this repository once carried. Nothing in the base verifies them after that removal, so treat pinned versions as the last known-good set and confirm each against its registry before installing. When a guide proves wrong, fix the guide in the same changeset as the code.

## Order

Add capabilities in this order. Each depends only on the ones before it.

1. [HTTP API](http-api.md): Elysia server with an Eden client contract.
2. [CLI](cli.md): Incur command-line entrypoint, usually a client of the API.
3. [PostgreSQL](postgres.md): Drizzle schema, immutable migrations, worktree-local database.
4. [Web UI](web-ui.md): React over the Eden contract, served same-origin in production.
5. [Rust and Node-API](rust-native.md): pure Rust crate behind a thin native adapter.
6. [Release](release.md): Git-tag versioning, standalone CLI binaries, container images.

## Shared hubs

Every capability touches some of these files. Edit each with the `mergeable-edits` discipline: append one entry, do not reorder.

| Hub                                          | What a capability adds                                             |
| -------------------------------------------- | ------------------------------------------------------------------ |
| `package.json`                               | workspace dependencies, scripts, `check` and `ci` steps            |
| `.github/workflows/ci.yml`                   | a job or step for the capability's authoritative check             |
| `.eph`                                       | a service block or environment variables                           |
| `.nudge.yaml`                                | deterministic rules, each with fixtures in `tests/fixtures/nudge`  |
| `.bastion.yaml`                              | a single-concern reviewer when a semantic invariant needs judgment |
| `AGENTS.md`                                  | one line in the check classification and any new invariants        |
| `.oxlintrc.json`, `.oxfmtrc.json`, `.ignore` | ignore patterns for generated files                                |
| `tools/doctor.ts`                            | a probe for a new required tool                                    |
