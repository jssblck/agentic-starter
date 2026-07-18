# ADR 0004: Node-API is the native boundary, not Bun FFI

Status: accepted

The Rust capability must be callable from Bun and ship inside the standalone CLI executable. Bun's direct FFI is lighter per call, but this boundary is deliberately coarse-grained, so per-call overhead does not dominate; what matters is production stability and packaging.

Native crates expose Node-API adapters built with napi-rs. Node-API is an established interface with broad tooling, Bun embeds Node-API addons in standalone executables, and `libs/native` stays the single loading point with a decoder that treats addon output as untrusted.

Revisit if the native surface becomes a fine-grained hot path where crossing overhead measurably dominates, or if Bun FFI reaches equivalent packaging support and production maturity.
