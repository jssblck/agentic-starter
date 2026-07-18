# Verify dependency changes with a clean clone, not the live node_modules

Problem: CI failed on main (lint 'error typed value' spam in apps/server plus a smoke-test 'Cannot find package elysia') while every local check was green. apps/server had gained direct Elysia imports without declaring elysia; the local isolated-linker graph predated that change and still resolved the package transitively, so lint, typecheck, and tests all passed against a link graph a fresh install would not produce.

Fix: declare the dependency in the workspace that imports it (apps/server got elysia 1.4.29), then run bun install followed by bun install --frozen-lockfile.

Verification: git clone the repo to a scratch directory, bun install --frozen-lockfile, and run lint, typecheck, and tests there. Only a fresh clone reproduces CI's resolution; re-running checks in the working checkout proves nothing after dependency or import changes.
