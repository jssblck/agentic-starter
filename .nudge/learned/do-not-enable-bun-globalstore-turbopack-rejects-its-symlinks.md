# Do not enable Bun globalStore; Turbopack rejects its symlinks

Problem: with bunfig.toml [install] globalStore = true, next build (Turbopack) failed with 'Symlink .../node_modules/.bun/<pkg>/node_modules/<dep> is invalid, it points out of the filesystem root'. globalStore replaces per-project hard links with symlinks into ~/.bun/install/cache/links, and Turbopack refuses to follow links outside the project root.

Fix: remove globalStore and keep linker = "isolated". The isolated linker still hard-links package files from Bun's cache (link count > 1 on package files), so worktrees still share bytes.

Verification: rm -rf node_modules, bun install, then bun run --cwd apps/web build compiles; stat -c %h node_modules/.bun/<pkg>@<ver>/node_modules/<pkg>/package.json shows a link count above 1.
