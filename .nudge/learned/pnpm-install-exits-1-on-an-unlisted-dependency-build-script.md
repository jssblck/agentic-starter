# pnpm install exits 1 on an unlisted dependency build script

Problem: after adding drizzle-kit (esbuild), the OpenTelemetry exporters (protobufjs), sharp, or the bun compiler, pnpm install and pnpm install --frozen-lockfile fail with ERR_PNPM_IGNORED_BUILDS, which breaks the SessionStart hook and CI. pnpm also edits pnpm-workspace.yaml itself, inserting a '<pkg>: set this to true or false' placeholder under allowBuilds; appending another entry then produces a duplicate key and a YAML parse error.

Fix: keep an allowBuilds map in pnpm-workspace.yaml and add each dependency's entry in the same commit that adds the dependency (esbuild: true, sharp: true, bun: true, protobufjs: false, unrs-resolver: false). Replace pnpm's placeholder line in place.

Verification: pnpm install --frozen-lockfile exits 0 in a fresh clone.
