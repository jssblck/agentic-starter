# Run next typegen before type-aware lint

Problem: on a fresh clone, pnpm run lint failed on every use of PageProps and LayoutProps ('error typed value') while the working checkout was green. Type-aware oxlint reads the same program as tsc, and next-env.d.ts plus .next/types do not exist until next typegen or next build has run; check ordered lint before typecheck.

Fix: a typegen script (pnpm --filter <web> exec next typegen) that runs first in check, with SKIP_ENV_VALIDATION=1 when the env module has server variables without defaults.

Verification: git clone to a scratch directory, pnpm install --frozen-lockfile, pnpm run check passes without a prior build.
