# Contributing

Workflow, check classification, and invariants live in `AGENTS.md`; read it before making changes.

Pull requests that modify policy files (`.nudge.yaml`, `.bastion.yaml`, `.eph`, hooks, workflows) should explain the effect on every worktree and on CI.

Commit dependency lockfiles. When a change touches a capability guide, verify the guide against the code in the same pull request.
