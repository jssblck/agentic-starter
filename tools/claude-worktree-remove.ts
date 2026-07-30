import { existsSync } from 'node:fs'
import { isAbsolute, join, normalize } from 'node:path'

const hookInput: unknown = await Bun.stdin.json()
const worktreePath = parseWorktreePath(hookInput)

if (!existsSync(join(worktreePath, '.eph'))) {
  process.exit(0)
}

const cleanup = Bun.spawnSync(['eph', 'clean'], {
  cwd: worktreePath,
  stdout: 'inherit',
  stderr: 'inherit',
})

process.exit(cleanup.exitCode)

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
