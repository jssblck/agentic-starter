import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { isAbsolute, join, normalize } from 'node:path'

let raw = ''
for await (const chunk of process.stdin) raw += chunk
const hookInput: unknown = JSON.parse(raw)
const worktreePath = parseWorktreePath(hookInput)

if (!existsSync(join(worktreePath, '.eph'))) {
  process.exit(0)
}

const cleanup = spawnSync('eph', ['clean'], { cwd: worktreePath, stdio: 'inherit' })

process.exit(cleanup.status ?? 1)

function parseWorktreePath(value: unknown): string {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('worktree_path' in value) ||
    typeof value.worktree_path !== 'string' ||
    !isAbsolute(value.worktree_path) ||
    normalize(value.worktree_path) !== value.worktree_path
  ) {
    throw new Error('WorktreeRemove did not provide a normalized absolute worktree_path')
  }

  return value.worktree_path
}
