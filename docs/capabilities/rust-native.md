# Rust and Node-API

Rust belongs where native integration, performance, or type-level guarantees justify a slower feedback loop. Domain logic lives in a pure crate; a thin Node-API adapter exposes a coarse interface to TypeScript. TypeScript-only work never compiles Rust.

## Packages

- `crates/<name>`: pure Rust library. No Node, HTTP, or database dependency. Owns the domain logic and its unit tests. A `build.rs` resolves `PROJECT_VERSION`, exact Git tag, or commit into a `VERSION` constant so TypeScript can compare identities at load time.
- `crates/<name>-napi`: `crate-type = ["cdylib"]`, depends on the pure crate and `napi`. Translates errors and serialization only. `build.rs` calls `napi_build::setup()`.
- `libs/native`: `load.ts` is the only file that loads `.node` code (a static `require('../artifacts/<name>.node')` through `createRequire(import.meta.url)`, so Bun can embed it when the release capability compiles a CLI). `decode.ts` treats addon output as `unknown` and proves its shape. `types.ts` declares the interface the rest of the code depends on. `artifacts/.gitkeep` marks the materialization directory.
- `tools/native-cache.ts`: content-addressed cache of built addons.
- `Cargo.toml` (workspace, resolver 3), `Cargo.lock` (committed), `rust-toolchain.toml` (pinned channel, `clippy` and `rustfmt` components, `minimal` profile).

## Dependencies

Rust workspace: `napi = { version = "3", default-features = false, features = ["napi8"] }`, `napi-derive = "3"`, `napi-build = "2"`, `serde` + `serde_json` for the wire format, `thiserror = "2"`, `semver = "1"` for the build script. Toolchain 1.97.1.

Root devDependency: `@napi-rs/cli` 3.7.3. `libs/native/package.json` carries `"napi": { "binaryName": "<name>" }`.

## Native cache

`pnpm run native:ensure` (`node tools/native-cache.ts`) computes a SHA-256 over: version, target triple, profile, `Cargo.toml`, `Cargo.lock`, `rust-toolchain.toml`, `libs/native/package.json`, and every `.rs` and `Cargo.toml` under `crates`. It looks up `~/.cache/<project>/native/<key>/`, builds into a per-key directory under a `mkdir`-based lock when missing (120 s timeout), and materializes the addon into `libs/native/artifacts` by hard link, falling back to copy. Worktrees with identical Rust inputs never rebuild; mutable `target` state stays per worktree. Never share `CARGO_TARGET_DIR` between worktrees.

Flags: `--release`, `--force`, `--target <triple>` (used by the release build).

## Invariants (add to `AGENTS.md`)

- The pure crate has no Node or database dependency; the napi crate is a thin adapter.
- Do not use `unwrap`; return an error or use `expect` only for a documented invariant.
- Keep the Node-API surface coarse-grained. Prefer batches or buffers for hot paths.
- Keep direct `.node` loading inside `libs/native/src/load.ts`.
- Run `pnpm run native:ensure` only when a real native integration test or executable needs the addon.

## Tests

- Rust unit tests in the pure crate prove semantics without Node.
- `libs/native/src/decode.test.ts` proves TypeScript rejects malformed addon output without compiling Rust.
- Only boundary and smoke tests need the built addon.

## Hubs

- `package.json`: `native:ensure`, `native:build` (`--release --force`), `rust:fmt`, `rust:fmt:check`, `rust:check` (`cargo check --locked --workspace --all-targets && cargo clippy --locked --workspace --all-targets --all-features -- -D warnings && cargo test --locked --workspace`). Add `rust:check` to `ci`, not `check`. Add `bootstrap` (`pnpm install --frozen-lockfile && pnpm run native:ensure`).
- `.gitignore`: `target/`, `libs/native/artifacts/*` with `!libs/native/artifacts/.gitkeep`, `*.node`, `.cache/`.
- `.oxlintrc.json`: ignore `target/**` and `libs/native/artifacts/**`; override `libs/native/src/load.ts` to allow `no-unsafe-assignment` and `no-unsafe-call` for the `require`.
- `.oxfmtrc.json`: ignore `target/**` and `libs/native/artifacts/**`.
- `.nudge.yaml`: `rust-no-unwrap` on `**/*.rs` with the tree-sitter query `(call_expression function: (field_expression field: (field_identifier) @method) (#eq? @method "unwrap"))`; add fixtures.
- `tools/doctor.ts`: probes for `rustc` and `cargo` pinned to the toolchain channel; report the addon as optional.
- `.github/workflows/ci.yml`: a `rust` job (`dtolnay/rust-toolchain@<channel>` with `rustfmt,clippy`, `Swatinem/rust-cache@v2`, fmt check, clippy, test) and `pnpm run native:ensure` in any integration job that needs the addon.
- `.eph`: `pre-start=pnpm run native:ensure` on services that load the addon.
- `AGENTS.md` check classification: "Rust core: run focused `cargo check --locked -p <crate>` and `cargo test --locked -p <crate>`; materialize the addon only for boundary tests. Native boundary: run both Rust checks and `pnpm run native:ensure`, then the native package tests."
- Docker (release capability): a `rust:<channel>-bookworm` builder stage that runs `cargo build --release --locked --package <name>-napi` and copies the `.so` as `<name>.node`.

## Why Node-API

Node-API is the stable ABI Node guarantees across majors, `napi-rs` handles marshalling, and the same addon loads unchanged inside a Bun-compiled CLI. WebAssembly is the alternative when the crate has no system dependencies and portability matters more than raw throughput.
