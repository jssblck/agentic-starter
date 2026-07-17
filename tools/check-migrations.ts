import { join } from 'node:path'

const root = join(import.meta.dir, '..')
const migrationPath = 'libs/db/drizzle/*.sql'

interface GitResult {
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}

function runGit(arguments_: readonly string[]): GitResult {
  const result = Bun.spawnSync({
    cmd: ['git', ...arguments_],
    cwd: root,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const decoder = new TextDecoder()
  return {
    exitCode: result.exitCode,
    stdout: decoder.decode(result.stdout).trim(),
    stderr: decoder.decode(result.stderr).trim(),
  }
}

function git(arguments_: readonly string[]): string {
  const result = runGit(arguments_)
  if (result.exitCode !== 0) {
    throw new Error(`git ${arguments_.join(' ')} failed: ${result.stderr || 'unknown error'}`)
  }
  return result.stdout
}

function hasRef(reference: string): boolean {
  return runGit(['rev-parse', '--verify', reference]).exitCode === 0
}

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  if (index === -1) return undefined
  const value = process.argv[index + 1]
  if (value === undefined || value.startsWith('--')) throw new Error(`${name} requires a value`)
  return value
}

if (!hasRef('HEAD')) {
  console.log('No commit exists yet; treating the checked-in migrations as the initial baseline')
  process.exit(0)
}

const explicitBase = option('--base')
const remoteBase = process.env['GITHUB_BASE_REF']
const defaultBase = remoteBase === undefined ? 'main' : `origin/${remoteBase}`
const base = explicitBase ?? (hasRef(defaultBase) ? defaultBase : 'HEAD')
if (!hasRef(base)) throw new Error(`Migration comparison base does not exist: ${base}`)

const committed =
  base === 'HEAD'
    ? ''
    : git(['diff', '--name-only', '--diff-filter=M', `${base}...HEAD`, '--', migrationPath])
const working = git(['diff', '--name-only', '--diff-filter=M', 'HEAD', '--', migrationPath])
const modified = new Set([...committed.split(/\r?\n/), ...working.split(/\r?\n/)].filter(Boolean))

if (modified.size > 0) {
  throw new Error(
    `Committed migrations are immutable; add a new migration instead of editing:\n${[...modified].join('\n')}`,
  )
}

console.log(`Committed migrations are unchanged relative to ${base}`)
