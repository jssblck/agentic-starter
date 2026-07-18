---
name: customize-starter
description: Rename and reshape the Agentic Starter without breaking package, API, native, database, worktree, or release contracts.
---

# Customize the starter

Read `docs/customizing.md` and `docs/architecture.md` before editing.

## Procedure

1. Establish the target display name, repository name and URL, package scope, CLI and server names, environment prefix, and description. Derive missing values only when the public contract is unambiguous.
2. Trace the current identity by role through package manifests and imports, binary names, environment variables, release artifact names, container and image paths, installers, cache namespaces, service configuration, and prose. Do not use a repository-wide replacement.
3. Apply role-specific edits while preserving the Bun and TypeScript base and the thin-bin boundary described in the architecture.
4. Update `.github/CODEOWNERS`, Bastion authentication, branch protection instructions, the license, and security contacts because ownership and policy cannot be inferred from naming.
5. Use the capability map in `docs/customizing.md` to delete any other subsystem as one unit, or replace the example vertical slice in dependency order.
6. Run `bun install`, inspect `bun.lock`, and then run `bun install --frozen-lockfile`. When Rust remains, run `cargo check --workspace --locked`.
7. Run `bun run native:ensure` and focused tests, then run `bun run check` and `bastion review --base main`.
8. Search for the old display name, repository name, package scope, CLI and server names, environment prefix, repository slug, and names owned by deleted capabilities.

## Guardrails

Keep executable packages thin and put dependency-injected application logic in `libs`. When native parsing remains, keep the pure Rust crate separate from the NAPI adapter and keep direct `.node` loading in `libs/native`. Delete unused capabilities completely instead of leaving disabled scripts or shims. Do not introduce fixed development ports. Do not publish a tag until installers and GHCR permissions have been tested in the derived repository.
