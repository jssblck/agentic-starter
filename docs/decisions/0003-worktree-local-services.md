# ADR 0003: Services are local to a Git worktree

Status: accepted

Development Postgres instances, volumes, and ports are managed by eph per checkout. Completed immutable dependency and native artifacts may be shared globally; mutable service and compiler state may not.

This avoids port collisions, accidental cross-branch data coupling, and Cargo incremental-state contention when several agents operate concurrently.
