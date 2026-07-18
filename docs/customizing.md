# Customizing the starter

## Permanent base

Every derived project keeps Bun, TypeScript, the workspace-level formatter, lint and type checks, Bun tests, the root agent instructions, and a deterministic policy gate. A project may replace every example binary and library, but it should retain at least one TypeScript workspace and keep `bun run check` as the local and CI entry point.

## Establish the new identity

Use the checked-in `customize-starter` skill before changing the example domain. Give the agent the target display name, repository name and URL, package scope, CLI and server names, environment prefix, and description. These values have different grammatical roles, so the agent traces each one through its consumers instead of applying one repository-wide replacement.

Review every changed release asset name, environment variable, package import, repository URL, installer default, and cache namespace.

## Replace the example in slices

1. Rename domain concepts in `libs/domain`.
2. Replace the pure Rust parser and its tests.
3. Adapt the native decoder and interface.
4. Change the Drizzle schema and create a new migration.
5. Change the Elysia schemas and Eden client facade in `libs/api`.
6. Update CLI commands.
7. Update the web routes and feature components.
8. Remove todo-specific tests and docs only after replacements exist.

This order keeps a compiling vertical slice and makes interface mismatches visible close to their source.

## Remove capabilities as units

Delete an unused capability instead of leaving disabled scripts, placeholder packages, or compatibility shims. Shared hubs such as `package.json`, `.github/workflows`, `.bastion.yaml`, `.nudge.yaml`, `.eph`, and the root docs must change in the same changeset.

| Capability              | Remove together                                                                                      | Consumers and shared hubs to update                                                                                                                                                                                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Rust and native parsing | `crates`, `libs/native`, the Cargo files, `rust-toolchain.toml`, and `tools/native-cache.ts`         | Replace imports in the server and CLI. Remove native scripts and dependencies, Rust and native CI work, Docker's native builder, version build scripts, and native docs.                                                                                                       |
| PostgreSQL persistence  | `libs/db`, `tools/check-migrations.ts`, and `tests/integration/database.test.ts`                     | Replace the server repository. Remove Drizzle dependencies and scripts, the Postgres eph role and environment, migration startup, the CI database service and migration check, and `docs/database.md`.                                                                         |
| Web UI                  | `apps/web`, `apps/server/src/web.ts` and its test, and the `.eph` web service                        | Remove `dev:web`, `build:web`, the web typecheck project, Docker's web-builder stage and dist copy, the CI web build step, `WEB_URL`, the React Nudge rule and fixtures, the generated route tree entries in `.ignore` and the oxlint and oxfmt configs, and `docs/web-ui.md`. |
| HTTP API                | `apps/server`, `libs/api`, and `tools/export-openapi.ts`                                             | Remove the Web UI first. Replace remote CLI commands or remove the CLI. Remove Elysia and Eden dependencies, `openapi:export` and its CI and release steps, server container paths, and `docs/http-api.md`.                                                                    |
| CLI distribution        | `apps/cli`, `tools/build-cli.ts`, and `tools/release-targets.ts`                                     | Remove CLI scripts and dependencies, binary release jobs, installer scripts, release assets, CLI smoke tests, `tools/check-release.ts`, and CLI sections in the release docs.                                                                                                  |
| Containers and releases | `Dockerfile`, `scripts/docker-entrypoint.sh`, installer scripts, and `.github/workflows/release.yml` | Remove release scripts and dependencies, `release:check`, version rewriting if no other consumer needs it, and `docs/versioning-and-releases.md`. Keep any deployment path the derived project actually uses.                                                                  |
| Shared build identity   | `libs/version`, `tools/write-version.ts`, and `tools/check-version.ts`                               | Remove version imports, API version endpoints, Rust build-script integration, release rewrites, and `version:check`. Remove this after native and release consumers are gone.                                                                                                  |
| Worktree-local services | `.eph` and `.env.example` service values                                                             | Remove `eph` from `doctor`, `policy:check`, CI policy setup, the fixed-port Nudge rule and fixtures, and service instructions. Keep Git worktrees and the fast check classification.                                                                                           |

For each removal:

1. Replace or remove consumers before deleting the capability.
2. Delete the capability and prune its entries from shared hubs.
3. Run `bun install` to update `bun.lock`, then prove the lock with `bun install --frozen-lockfile`.
4. Search for the removed package names, commands, environment variables, workflow jobs, reviewer names, and docs.
5. Run `bun run check`. The surviving check must not contain a no-op branch for the deleted capability.

## Repository administration

Update:

- `.github/CODEOWNERS` teams;
- Bastion authentication and repository variable;
- branch protection required checks;
- package visibility and license;
- GHCR package visibility;
- installer repository default;
- security and support contacts;
- deployment-specific Postgres policy.

## First clean baseline

```sh
bun install
bun install --frozen-lockfile
cargo check --workspace --locked
bun run native:ensure
bun run check

git add bun.lock
```

The first install updates workspace names inside `bun.lock`; the frozen install proves that its package graph still agrees with the manifests. `Cargo.lock` is committed and every Cargo command should use it.

Create `v0.1.0` only after installer URLs, image permissions, and release runners are verified in the derived repository.
