# Release

Git tags are the only version source. One resolved value reaches every package manifest, the lockfile, Rust, the API, archives, and container labels, so nothing drifts from the published artifact.

Sub-capabilities, each optional: shared version identity, standalone CLI binaries with installers, container images.

## Version identity

- `libs/version`: `resolveVersionInfo()` returns `{ version, tag, commit, dirty, source }`. Precedence: `PROJECT_VERSION` env (semver or `v`-prefixed) > `generated.ts` (written during release builds) > exact `git describe --tags --exact-match --match 'v[0-9]*'` > `0.0.0+g<sha12>[.dirty]` > `0.0.0+unknown`. Export `VERSION` and a `versionPayload()` for API endpoints.
- `libs/version/src/generated.ts`: committed as `0.0.0` / `null` / `unknown`. `tools/write-version.ts --version X` rewrites it, every `package.json` version, the importer entries in `pnpm-lock.yaml`, `[workspace.package].version` in `Cargo.toml`, and `build/version.json`. Never commit these rewrites from an ordinary branch.
- `tools/check-version.ts`: every manifest carries the same version and it is `0.0.0` on a branch. Add `version:check` to `ci`.
- Rust (if present) resolves the same identity in its `build.rs`; `libs/native` compares it at load time.
- `AGENTS.md` check classification: "Release/tooling: run `pnpm run version:check` and `pnpm run release:check`."

## CLI binaries

Requires the [CLI](cli.md).

Bun is the compile target and nothing else. `bun build --compile` bundles the runtime, the TypeScript source, dependencies, and any Node-API addon into one executable per platform, so users install nothing. Add `bun` as a root dev dependency (`bun` on npm, exact pin) so `pnpm install` provides the compiler locally and in CI; nothing runs on Bun in development or in tests. Bun resolves imports from pnpm's isolated `node_modules` layout; verify the first build from a fresh clone.

- `tools/release-targets.ts`: `RELEASE_TARGETS` map, `linux-x64` / `linux-arm64` / `macos-x64` / `macos-arm64` / `windows-x64`, each with GitHub runner (`ubuntu-24.04`, `ubuntu-24.04-arm`, `macos-15-intel`, `macos-15`, `windows-2025`), Rust target, Bun compile target (`bun-linux-x64-baseline`, `bun-linux-arm64`, `bun-darwin-x64`, `bun-darwin-arm64`, `bun-windows-x64-baseline`), triple, executable name, archive format.
- `tools/build-cli.ts --target <name> --out-dir <dir>`: materializes the native addon for that target if Rust is present, then `bun build apps/cli/src/main.ts --compile --target=<bun> --minify --bytecode --outfile=<dir>/<exe>`.
- `scripts/install.sh` and `scripts/install.ps1`: download `<name>-<triple>.{tar.gz,zip}` and `checksums.txt` from a GitHub release, verify SHA-256, install to `~/.local/bin` (override with `<PREFIX>_REPO`, `<PREFIX>_VERSION`, `<PREFIX>_BIN_DIR`).
- `tools/check-release.ts`: parses the workflow matrix and both installers and fails when a target, triple, runner, or archive name disagrees with `release-targets.ts`, or when checksum verification is missing. Add `release:check` to `ci`.
- `.github/workflows/release.yml` on `push: tags: ['v*.*.*']`: `prepare` (validate tag, emit version), `binaries` matrix (checkout with `fetch-depth: 0`, setup pnpm and Node, toolchain if Rust, `pnpm install --frozen-lockfile`, `write-version`, `build-cli`, smoke test `--version`, package with README/LICENSE/NOTICE, upload artifact), `github-release` (download artifacts, add installers, `sha256sum <name>-* > checksums.txt`, `gh release create "$GITHUB_REF_NAME" artifacts/* --verify-tag --generate-notes`).
- Use native-architecture runners so any embedded addon matches the Bun target.

## Container image

Requires the [API server](api-server.md) or [Web app](web-app.md).

- `Dockerfile`: builder stages for Rust (`rust:<channel>-bookworm`, `cargo build --release --locked`) and the web UI (`pnpm run build:web`) when present; an `app-builder` stage on `node:<major>-alpine` that runs `corepack enable`, `pnpm install --frozen-lockfile`, `write-version`, then `pnpm deploy --prod --filter <app> /out` to produce a pruned tree with its own `node_modules`; a runtime stage on the same image that copies `/out`, runs `node <app>/src/main.ts` as `node`, exposes the port, and has a `HEALTHCHECK` on `/api/health`.
- `scripts/docker-entrypoint.sh`: runs migrations only when `RUN_MIGRATIONS=1`, then `exec "$@"`.
- `.dockerignore`: `.git`, `.github`, `node_modules`, `target`, `dist`, `.cache`, `.bastion`, `coverage`, `*.md` except `README.md`.
- Workflow `container` job: QEMU + buildx, login to GHCR with `GITHUB_TOKEN`, `docker/metadata-action` semver tags plus `latest` for non-prerelease, `docker/build-push-action` for `linux/amd64,linux/arm64` with `provenance: mode=max` and `sbom: true`, `actions/attest` when the repo is public. Needs `packages: write`, `attestations: write`, `id-token: write`.

## Hubs

- `package.json`: `version:write`, `version:check`, `release:check`, `build:cli`.
- `.github/CODEOWNERS`: protect `/scripts/`, `tools/write-version.ts`, `tools/build-cli.ts`, and the workflow from self-modifying agent changes.
- `docs`: keep archive names stable and documented; installers depend on them.

## Before the first tag

Verify installer URLs, GHCR package visibility, and release runners in the derived repository. Create `v0.1.0` only after that.
