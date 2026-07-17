import { mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import { RELEASE_TARGETS } from './release-targets.ts'

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  if (index === -1) return undefined
  const value = process.argv[index + 1]
  if (value === undefined || value.startsWith('--')) throw new Error(`${name} requires a value`)
  return value
}

async function run(command: readonly string[]): Promise<void> {
  const processHandle = Bun.spawn([...command], {
    cwd: join(import.meta.dir, '..'),
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
    env: process.env,
  })
  const exitCode = await processHandle.exited
  if (exitCode !== 0) throw new Error(`${command.join(' ')} exited with ${exitCode}`)
}

const platformName =
  process.platform === 'darwin'
    ? 'macos'
    : process.platform === 'win32'
      ? 'windows'
      : process.platform
const targetName =
  option('--target') ?? `${platformName}-${process.arch === 'x64' ? 'x64' : 'arm64'}`
const target = RELEASE_TARGETS[targetName]
if (target === undefined) {
  throw new Error(
    `Unknown --target ${targetName}. Choose ${Object.keys(RELEASE_TARGETS).join(', ')}`,
  )
}

const outDirectory = resolve(option('--out-dir') ?? join(import.meta.dir, '..', 'dist', targetName))
await mkdir(outDirectory, { recursive: true })
await run(['bun', 'tools/native-cache.ts', '--release', '--target', target.rust])
await run([
  'bun',
  'build',
  'bins/cli/src/main.ts',
  '--compile',
  `--target=${target.bun}`,
  '--minify',
  '--bytecode',
  `--outfile=${join(outDirectory, target.executable)}`,
])
console.log(`Built ${join(outDirectory, target.executable)}`)
