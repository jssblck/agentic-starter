# Verify dependency changes with a clean clone, not the live node_modules

Problem: CI failed on main (type-aware lint 'error typed value' spam plus a runtime 'Cannot find package') while every local check was green. A workspace had gained direct imports of a package without declaring it; the local isolated-linker graph predated that change and still resolved the package transitively, so lint, typecheck, and tests all passed against a link graph a fresh install would not produce.

Fix: declare the dependency in the workspace that imports it, then run bun install followed by bun install --frozen-lockfile.

Verification: git clone the repo to a scratch directory, bun install --frozen-lockfile, and run bun run check there. Only a fresh clone reproduces CI's resolution; re-running checks in the working checkout proves nothing after dependency or import changes.
