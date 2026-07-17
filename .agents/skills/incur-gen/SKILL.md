---
name: incur-gen
description: Generate type definitions for development. Run `incur gen --help` for usage details.
requires_bin: incur
command: incur gen
---

# incur gen

Generate type definitions for development.

## Options

| Flag             | Type      | Default | Description                                            |
| ---------------- | --------- | ------- | ------------------------------------------------------ |
| `--configSchema` | `boolean` |         | Generate config JSON Schema (auto-detected by default) |
| `--dir`          | `string`  |         | Project root directory                                 |
| `--entry`        | `string`  |         | Entrypoint path (absolute)                             |
| `--output`       | `string`  |         | Output path (absolute)                                 |
