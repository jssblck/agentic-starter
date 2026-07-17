import { join } from 'node:path'

import { RELEASE_TARGETS } from './release-targets.ts'

const root = join(import.meta.dir, '..')

function requireMatch(value: string, pattern: RegExp, message: string): void {
  if (!pattern.test(value)) throw new Error(message)
}

function parseReleaseMatrix(workflow: string): ReadonlyMap<string, ReadonlyMap<string, string>> {
  const start = workflow.indexOf('        include:')
  const end = workflow.indexOf('\n    runs-on:', start)
  if (start === -1 || end === -1) throw new Error('Release workflow has no readable matrix')

  const entries = new Map<string, ReadonlyMap<string, string>>()
  let fields: Map<string, string> | undefined
  for (const line of workflow.slice(start, end).split(/\r?\n/)) {
    const first = /^\s+- ([a-z_]+):\s*(.+)$/.exec(line)
    if (first !== null) {
      if (fields !== undefined) {
        const name = fields.get('target_name')
        if (name === undefined) throw new Error('Release matrix entry has no target_name')
        entries.set(name, fields)
      }
      const key = first[1]
      const value = first[2]
      if (key === undefined || value === undefined)
        throw new Error('Malformed release matrix entry')
      fields = new Map([[key, value]])
      continue
    }

    const field = /^\s+([a-z_]+):\s*(.+)$/.exec(line)
    if (field !== null && fields !== undefined) {
      const key = field[1]
      const value = field[2]
      if (key === undefined || value === undefined)
        throw new Error('Malformed release matrix field')
      fields.set(key, value)
    }
  }
  if (fields !== undefined) {
    const name = fields.get('target_name')
    if (name === undefined) throw new Error('Release matrix entry has no target_name')
    entries.set(name, fields)
  }
  return entries
}

const [workflow, shellInstaller, powershellInstaller] = await Promise.all([
  Bun.file(join(root, '.github', 'workflows', 'release.yml')).text(),
  Bun.file(join(root, 'scripts', 'install.sh')).text(),
  Bun.file(join(root, 'scripts', 'install.ps1')).text(),
])

const matrix = parseReleaseMatrix(workflow)
if (matrix.size !== Object.keys(RELEASE_TARGETS).length) {
  throw new Error(
    `Release matrix has ${matrix.size} targets; expected ${Object.keys(RELEASE_TARGETS).length}`,
  )
}

for (const [name, target] of Object.entries(RELEASE_TARGETS)) {
  const entry = matrix.get(name)
  if (entry === undefined) throw new Error(`Release matrix is missing ${name}`)

  const expected = {
    runner: target.runner,
    rust_target: target.rust,
    triple: target.triple,
    executable: target.executable,
    format: target.format,
  }
  for (const [field, value] of Object.entries(expected)) {
    if (entry.get(field) !== value) {
      throw new Error(`${name}.${field} is ${entry.get(field) ?? 'missing'}; expected ${value}`)
    }
  }

  requireMatch(
    shellInstaller,
    new RegExp(`triple="${target.triple.replaceAll('-', '\\-')}"`),
    `Shell installer does not map ${name} to ${target.triple}`,
  )
}

const windowsTarget = RELEASE_TARGETS['windows-x64']
if (windowsTarget === undefined) throw new Error('Release targets lack windows-x64')
requireMatch(
  powershellInstaller,
  new RegExp(`\\$triple = "${windowsTarget.triple.replaceAll('-', '\\-')}"`),
  'PowerShell installer does not select the Windows release triple',
)

requireMatch(workflow, /sha256sum todoctl-\* > checksums\.txt/, 'Release does not create checksums')
requireMatch(
  shellInstaller,
  /\[ "\$actual" = "\$expected" \]/,
  'Shell installer does not verify the selected checksum',
)
requireMatch(
  powershellInstaller,
  /\$expected -ne \$actual/,
  'PowerShell installer does not verify the selected checksum',
)
requireMatch(
  workflow.slice(workflow.indexOf('  container:'), workflow.indexOf('  github-release:')),
  /packages: write/,
  'Container release lacks package write permission',
)

console.log(`Release workflow and installers agree on ${matrix.size} targets and checksums`)
