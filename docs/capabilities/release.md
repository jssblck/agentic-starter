# Release

Git tags are the only version source. One resolved value reaches every package manifest, the lockfile, Rust, the API, archives, and container labels, so nothing drifts from the published artifact.

Sub-capabilities, each optional: shared version identity, standalone CLI binaries with installers, container images.

## Version identity

- `libs/version`: `resolveVersionInfo(options)` returns `{ version, tag, commit, dirty, source }`. It takes the environment override as an argument rather than reading `process.env`, which the `env-no-direct-process-env` rule forbids everywhere under `libs/`; the app passes its decoded value in. Memoize the result and keep the computation in a separate exported function so tests can vary the input. Precedence: `PROJECT_VERSION` env (semver or `v`-prefixed) > `generated.ts` (written during release builds) > exact `git describe --tags --exact-match --match 'v[0-9]*'` > `0.0.0+g<sha12>[.dirty]` > `0.0.0+unknown`. Export `VERSION` and a `versionPayload()` for API endpoints.
- `libs/version/src/generated.ts`: committed as `0.0.0` / `null` / `unknown`. `tools/write-version.ts --version X` rewrites it, every `package.json` version, `[workspace.package].version` in `Cargo.toml`, and `build/version.json`. Never commit these rewrites from an ordinary branch. It does **not** touch `pnpm-lock.yaml`: a lockfileVersion 9 lockfile records no importer versions, and workspace dependencies are `workspace:*` specifiers.
- `tools/check-version.ts`: every manifest carries the same version and it is `0.0.0` on a branch. Add `version:check` to `ci`.
- Rust (if present) resolves the same identity in its `build.rs`; `libs/native` compares it at load time.
- `AGENTS.md` check classification: "Release/tooling: run `pnpm run version:check` and `pnpm run release:check`."

## CLI binaries

Requires the [CLI](cli.md).

Bun is the compile target and nothing else. `bun build --compile` bundles the runtime, the TypeScript source, dependencies, and any Node-API addon into one executable per platform, so users install nothing. Add `bun` as a root dev dependency (`bun` on npm, exact pin) with `allowBuilds` entry `bun: true` (its install script downloads the binary), so `pnpm install` provides the compiler locally and in CI; nothing runs on Bun in development or in tests. Bun resolves imports from pnpm's isolated `node_modules` layout (verified: a CLI with Hono, Incur, and a Rust addon compiled to a 96 MB executable). The addon loader must be the CommonJS `load.cjs` from [Rust](rust-native.md); Bun does not embed a `createRequire` load.

Incur 0.5 ships `incur build`, which compiles the eight default targets, writes `SHA256SUMS`, and generates `install.sh` and `install.ps1` that verify checksums and install to `~/.local/bin`. Prefer it over the hand-rolled `build-cli.ts` and installer scripts below; keep those only when a project needs a target or archive layout Incur does not produce.

- `tools/release-targets.ts`: `RELEASE_TARGETS` map, `linux-x64` / `linux-arm64` / `macos-x64` / `macos-arm64` / `windows-x64`, each with GitHub runner (`ubuntu-24.04`, `ubuntu-24.04-arm`, `macos-15-intel`, `macos-15`, `windows-2025`), Rust target, Bun compile target (`bun-linux-x64-baseline`, `bun-linux-arm64`, `bun-darwin-x64`, `bun-darwin-arm64`, `bun-windows-x64-baseline`), triple, executable name, archive format.
- `tools/build-cli.ts --target <name> --out-dir <dir>`: materializes the native addon for that target if Rust is present, then `bun build apps/cli/src/main.ts --compile --target=<bun> --minify --bytecode --outfile=<dir>/<exe>`.
- `scripts/install.sh` and `scripts/install.ps1`: download `<name>-<triple>.{tar.gz,zip}` and `checksums.txt` from a GitHub release, verify SHA-256, install to `~/.local/bin` (override with `<PREFIX>_REPO`, `<PREFIX>_VERSION`, `<PREFIX>_BIN_DIR`).
- `tools/check-release.ts`: parses the workflow matrix and both installers and fails when a target, triple, runner, or archive name disagrees with `release-targets.ts`, or when checksum verification is missing. Add `release:check` to `ci`.
- `.github/workflows/release.yml` on `push: tags: ['v*.*.*']`: `prepare` (validate tag, emit version), `binaries` matrix (checkout with `fetch-depth: 0`, setup pnpm and Node, toolchain if Rust, `pnpm install --frozen-lockfile`, `write-version`, `build-cli`, smoke test `--version`, package with README/LICENSE/NOTICE, upload artifact), `github-release` (download artifacts, add installers, `sha256sum <name>-* > checksums.txt`, `gh release create "$GITHUB_REF_NAME" artifacts/* --verify-tag --generate-notes`).
- Use native-architecture runners so any embedded addon matches the Bun target.

## Container image

Requires the [API server](api-server.md) or [Web app](web-app.md).

- `Dockerfile` for a Node process (Hono server, worker): a builder stage on `node:<major>-alpine` that runs `corepack enable`, copies `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `package.json`, `.npmrc`, `.sops.yaml`, `apps`, `libs`, `secrets`, and `tools`, then `pnpm install --frozen-lockfile --prod --filter @scope/<app>...` (the app and every workspace package it depends on, in place) and `write-version`; a runtime stage on the same image that copies the whole `/repo` and the `sops` binary (`ADD https://github.com/getsops/sops/releases/download/v<version>/sops-v<version>.linux.amd64 /usr/local/bin/sops` plus `RUN chmod 755`; pin the version the base's doctor reports). Use plain `ADD` and `COPY` with a separate `RUN chmod`, not `ADD --chmod` or `COPY --chmod`: those need BuildKit, and this image should build with either builder, runs `node tools/secrets.ts exec prod -- node apps/<app>/src/main.ts` as `node`, exposes the port, and has a `HEALTHCHECK` on `/api/health`. The service gets one variable, `SOPS_AGE_KEY`, holding the `prod` identity ([Secrets](../secrets.md)); the wrapper removes it from the app's environment. Do not use `pnpm deploy`: it moves workspace packages under `node_modules/.pnpm`, and Node refuses to strip types inside `node_modules` (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`), so `.ts` libs must stay outside it. Expect about 140 MB of `node_modules` for a worker with pg-boss, Drizzle, and OpenTelemetry.
- `Dockerfile` for the Next app: the standalone recipe in [Web app](web-app.md); it also copies the root `tsconfig.json` and builds with `SKIP_ENV_VALIDATION=1`. Rust builder stages (`rust:<channel>-bookworm`, `cargo build --release --locked`) precede either when the app loads the addon.
- `scripts/docker-entrypoint.sh`: runs migrations only when `RUN_MIGRATIONS=1`, then `exec "$@"`. The migration entrypoint belongs to an app, not to `tools/`: a filtered `--prod` install links workspace packages only for the filtered app, so a `tools/` script that imports `@scope/db` cannot resolve it inside the image.
- Anything a Next server bundle can import must not compute a path from `import.meta.dirname` at module scope. A bundler leaves it undefined and `next build` fails with `The "paths[0]" argument must be of type string` while collecting page data. Export a function instead.
- The web image is the only one that needs a build-time secret (`NEXT_PUBLIC_*` inlining), so it needs BuildKit: `docker buildx build --secret id=SOPS_AGE_KEY,src=<file>`. The worker image builds with either builder.
- `.dockerignore`: `.git`, `.github`, `node_modules`, `target`, `dist`, `.cache`, `.bastion`, `coverage`, `*.md` except `README.md`.
- Workflow `container` job: QEMU + buildx, login to GHCR with `GITHUB_TOKEN`, `docker/metadata-action` semver tags plus `latest` for non-prerelease, `docker/build-push-action` for `linux/amd64,linux/arm64` with `provenance: mode=max` and `sbom: true`, `actions/attest` when the repo is public. Needs `packages: write`, `attestations: write`, `id-token: write`.

## Hubs

- `package.json`: `version:write`, `version:check`, `release:check`, `build:cli`.
- `.github/CODEOWNERS`: protect `/scripts/`, `tools/write-version.ts`, `tools/build-cli.ts`, and the workflow from self-modifying agent changes.
- `docs`: keep archive names stable and documented; installers depend on them.

## Before the first tag

Verify installer URLs, GHCR package visibility, and release runners in the derived repository. Create `v0.1.0` only after that.
