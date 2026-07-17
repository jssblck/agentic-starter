# Versioning and releases

## One version source

The authoritative release identifier is an exact Git tag matching `vX.Y.Z` with an optional prerelease suffix.

`libs/version` resolves source-checkout identities. `tools/write-version.ts` materializes release metadata into:

- every application/library `package.json`;
- workspace version entries in `bun.lock`;
- `[workspace.package].version` in `Cargo.toml`;
- `libs/version/src/generated.ts`;
- `build/version.json`.

The Rust parser build script independently resolves `PROJECT_VERSION`, exact Git tag, or commit identity and compiles it into the crate. `libs/native` compares that value with TypeScript at load time.

## Local source identities

An untagged checkout returns `0.0.0+g<short-sha>`. A dirty tracked worktree appends `.dirty`. This value is useful for diagnostics and native-cache identity; it is not published as a release package version.

## GitHub release workflow

On a pushed tag, the workflow:

1. validates and extracts the semantic version;
2. rewrites all metadata;
3. builds the Rust addon for the runner's target;
4. embeds that addon in a Bun standalone CLI;
5. runs the platform binary's version command;
6. packages README, license, notice, and executable;
7. produces SHA-256 checksums;
8. attaches the shell and PowerShell installers and publishes a GitHub release;
9. builds and pushes a Linux amd64/arm64 server image to GHCR;
10. attaches provenance and SBOM information to the image.

The runner matrix uses native architecture runners so the Rust linker and embedded Node-API addon match the Bun executable target.

## Installer contract

Archive names are stable:

```text
todoctl-x86_64-unknown-linux-gnu.tar.gz
todoctl-aarch64-unknown-linux-gnu.tar.gz
todoctl-x86_64-apple-darwin.tar.gz
todoctl-aarch64-apple-darwin.tar.gz
todoctl-x86_64-pc-windows-msvc.zip
checksums.txt
install.sh
install.ps1
```

Both installers verify the selected archive against `checksums.txt`. Keep artifact naming, release matrix, and installer mapping in one pull request.

`bun run release:check` compares the checked-in target catalog with the GitHub matrix and both installers. It also requires checksum verification and the package permission used by the container release.

## Container migrations

The image defaults `RUN_MIGRATIONS=0`. Set it to `1` only when one container instance is responsible for serialized migration execution, or run `bun libs/db/src/migrate.ts` as a separate release task.
