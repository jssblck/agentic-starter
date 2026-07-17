# Worktree Todo Starter

A deliberately overbuilt todo application used as a template for a small team running several coding agents in parallel Git worktrees.

The repository combines:

- Bun workspaces for thin server and CLI executables plus dependency-injected API, database, native, domain, and version libraries.
- Incur for schema-based command, option, environment, help, version, and agent-facing output handling in both executables.
- TypeScript 7 with strict compiler options, type-aware Oxlint, Oxfmt, and deterministic Nudge rules that reject common type-system escape hatches.
- Elysia for the HTTP server and OpenAPI document.
- Drizzle ORM with PostgreSQL and checked-in SQL migrations.
- A pure Rust parser wrapped by a thin napi-rs package and consumed by both the CLI and server.
- eph for collision-free services and ports in every Git worktree.
- Bastion for narrow semantic reviewers that cover contracts, migrations, native boundaries, worktree isolation, and releases.
- GitHub Actions for CI, tagged CLI binaries, checksums, installers, a multi-architecture GHCR image, SBOMs, and build provenance.

The example syntax is intentionally simple:

```text
Buy oat milk @home #errands !high due:2026-08-01
```

The Rust library turns that into a typed value. The CLI can inspect it locally or send the original input to the server. The server parses it again at the trust boundary and persists it in Postgres.

## Repository shape

```text
bins/
  cli/                    standalone Bun CLI
  server/                 server configuration, wiring, and process lifecycle
libs/
  api/                    Elysia app factory and Eden Treaty client
  db/                     Drizzle schema, repository, migrations
  domain/                 stable TypeScript domain types
  native/                 only package allowed to load the .node addon
  version/                Git-tag-derived build identity
crates/
  todo-parser/            pure Rust parser and tests
  todo-parser-napi/       thin Node-API adapter
tools/                    versioning, native cache, policy checks
scripts/                  installers and container entrypoint
```

Read `docs/architecture.md` for the dependency boundaries and why they exist.

## Quick start

Prerequisites are Bun 1.3.14, Rust 1.97.1, Docker, Git, and eph. Nudge and Bastion are required for the complete policy loop and optional for simply running the example.

```sh
bun install --frozen-lockfile
bun run doctor
bun run native:ensure
eph dev
```

`eph dev` starts an isolated Postgres container, chooses a free server port, runs migrations, and foregrounds the Elysia server. In another shell:

```sh
eval "$(eph env)"

bun run cli -- add "Buy oat milk @home #errands !high due:2026-08-01"
bun run cli -- list
bun run cli -- parse "Write release notes @office #release !urgent" --json
```

The OpenAPI UI is at `${TODO_API_URL}/openapi`; the raw document is at `${TODO_API_URL}/openapi/json`.

The Bun and Cargo lockfiles are checked in. CI and release builds use both in locked mode:

```sh
bun install --frozen-lockfile
cargo check --workspace --locked
```

## Fast checks by change class

The repository does not make TypeScript-only work pay for Rust compilation.

```sh
# High-churn product code
bun run fmt:check
bun run lint
bun run typecheck
bun run test

# Pure Rust parser work
cargo check --locked -p todo-parser
cargo test --locked -p todo-parser

# Native boundary work
bun run native:ensure
bun test libs/native

# Full merge gate
bun run check
```

`tools/native-cache.ts` hashes Rust source, Cargo metadata, toolchain, build profile, target triple, and resolved version. Compatible worktrees hard-link or copy the completed `.node` artifact from a content-addressed user cache. Cargo's mutable `target` state remains isolated.

## TypeScript guardrails

The compiler is configured with strict nullability, unchecked-index protection, exact optional properties, unknown catch variables, exhaustive returns, and several other high-signal checks.

Oxlint adds type-aware unsafe-operation rules. Nudge blocks deterministic escapes before an agent writes them and repeats those checks in CI:

- explicit `any` annotations;
- non-null assertions;
- `@ts-ignore`, `@ts-nocheck`, and `@ts-expect-error`;
- `as unknown as` laundering;
- Rust `unwrap()` at the native boundary.

External values are decoded at the edge. `libs/native/src/decode.ts` is the worked example: the addon returns JSON, TypeScript receives `unknown`, and a decoder proves every field before creating a `ParsedTodo`.

See `docs/type-safety.md`.

## Eden as the server-to-CLI type link

`libs/api` exports the complete Elysia `App` type. Its `TodoApiClient` passes that type to Eden Treaty, so the compiler checks every CLI route, parameter, body, status, and response without a generated contract file.

The type-only link disappears from the compiled CLI, which still communicates with the server over HTTP. Elysia continues to expose runtime OpenAPI documentation for interactive inspection and external tooling.

See `docs/http-api.md`.

## Worktrees and eph

Create one full-repository Git worktree per agent. Do not create separate TypeScript and Rust worktrees for one changeset; cross-boundary edits should remain one atomic commit.

```sh
git worktree add ../worktrees/agent-42 -b agent/42 main
cd ../worktrees/agent-42
bun install --frozen-lockfile
eph dev
```

The `.eph` file gives every checkout its own Postgres container, volume, and assigned server port. `bunfig.toml` keeps each checkout's dependency graph local while reusing Bun's global package store.

See `docs/worktrees.md`.

## Agent policy

`AGENTS.md` is the authoritative workflow. The repository also contains a `customize-starter` skill for Codex-compatible agents and Claude Code.

Set up the tool-specific skills and hooks after cloning:

```sh
nudge codex setup
nudge claude setup
bastion skills install
eph skills install
```

Local semantic review:

```sh
bastion validate
bastion review --base main
```

The included Bastion GitHub workflow is opt-in. Set repository variable `BASTION_ENABLED=true`, configure `CODEX_AUTH_JSON` or replace the sample authentication step with a per-author mapping, and then make the aggregate `bastion` check required.

## Versioning

Every workspace package, Rust crate, CLI, server, and native addon resolves one version.

- On an exact tag such as `v0.1.0`, runtime version is `0.1.0`.
- On an untagged source checkout, runtime version is `0.0.0+g<commit>` with `.dirty` when applicable.
- Release jobs pass `PROJECT_VERSION`, rewrite package and Cargo metadata, and compile the same value into TypeScript and Rust.
- The native loader refuses to start when the addon version and TypeScript version differ.

```sh
bun run version:write -- --version 0.1.0
bun run version:check
```

Release metadata is generated during the workflow and is not intended to be committed from an ordinary development branch.

## Releases

Pushing `vX.Y.Z` runs `.github/workflows/release.yml` and creates:

- Linux x64 and arm64 CLI archives;
- macOS Intel and Apple Silicon CLI archives;
- a Windows x64 CLI archive;
- `checksums.txt` covering every archive;
- a GitHub release containing the archives, checksums, and both installer scripts;
- a multi-architecture server image in `ghcr.io/<owner>/<repo>`;
- provenance and SBOM metadata for the image.

Installer entry points:

```sh
curl -fsSL https://raw.githubusercontent.com/your-org/worktree-todo-starter/main/scripts/install.sh | sh
```

```powershell
irm https://raw.githubusercontent.com/your-org/worktree-todo-starter/main/scripts/install.ps1 | iex
```

The installers detect the platform, select the matching release archive, and verify its SHA-256 checksum before installation.

See `docs/versioning-and-releases.md`.

## Customizing the template

Use the checked-in `customize-starter` skill before replacing the todo domain. Give the agent the target display name, repository name and URL, package scope, CLI and server names, environment prefix, and description. The skill keeps those grammatical roles separate and traces each change through manifests, locks, releases, installers, services, and docs.

Review the diff, update `.github/CODEOWNERS`, run `bun install` to update the lockfile, and prove the result with `bun install --frozen-lockfile`. Then remove or reshape the example in coherent capability units. Bun and TypeScript remain the permanent base; `docs/customizing.md` maps every removable subsystem to its consumers and checks.

See `docs/customizing.md`.

## Upstream tools

- Bun: https://bun.sh/
- TypeScript: https://www.typescriptlang.org/
- Elysia: https://elysiajs.com/
- Drizzle: https://orm.drizzle.team/
- napi-rs: https://napi.rs/
- Oxlint and Oxfmt: https://oxc.rs/
- Nudge: https://github.com/attunehq/nudge
- Bastion: https://github.com/jssblck/bastion
- eph: https://github.com/attunehq/doteph
