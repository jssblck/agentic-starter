# ADR 0001: Bun control plane with a Rust kernel

Status: accepted

High-churn application and orchestration code uses TypeScript on Bun. Memory-sensitive or CPU-heavy capabilities may live in small pure Rust crates exposed through thin Node-API adapters.

This keeps ordinary feedback loops fast, gives coding agents a highly familiar language for product behavior, and retains Rust's guarantees where they purchase concrete safety or performance. Native compilation is isolated and cached by content rather than tied to package installation.
