# Exclude committed generated files from nudge check via the root .ignore

Problem: bun run check failed in policy:check because nudge check flagged apps/web/src/routeTree.gen.ts (typescript-no-any, typescript-no-checker-suppression). TanStack Router emits '@ts-nocheck' and 'as any' in its generated route tree by design, and rule 'file:' globs accept only a single positive pattern, so a per-rule exclusion is not expressible.

Fix: nudge check walks files with gitignore semantics, so a committed generated file can be excluded by listing it in the root .ignore file. oxlint and oxfmt do not read .ignore and need the same path in their own ignorePatterns.

Verification: nudge check apps/web reports the file before the entry and skips it after; bun run check exits 0.
