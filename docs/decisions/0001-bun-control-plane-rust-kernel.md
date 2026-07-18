# ADR 0001: Bun control plane with a Rust kernel

Status: accepted

Parallel worktrees multiply feedback-loop costs. A native build that is tolerable for one developer becomes repeated compilation, isolated Cargo state, and longer merge and CI queues when several agents change speculative branches at once. Sharing mutable Cargo output between divergent worktrees replaces compilation cost with lock contention and invalidation churn.

High-churn application and orchestration code uses TypeScript on Bun, so ordinary product changes can format, lint, typecheck, and test without invoking Cargo. Strict compiler settings, runtime boundary decoders, deterministic Nudge rules, and focused Bastion reviewers provide fast guardrails for that path.

Memory-sensitive, CPU-heavy, or native capabilities may live in small pure Rust crates exposed through thin Node-API adapters. Rust logic remains independently testable, calls across the native boundary stay coarse-grained, and completed addons are cached by content. Each worktree keeps its mutable Cargo state isolated.
