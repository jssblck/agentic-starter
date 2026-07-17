import { copyFile, link, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, join } from 'node:path'

import { VERSION } from '@starter/version'

interface Options {
  readonly release: boolean
  readonly force: boolean
  readonly target: string | null
}

const root = join(import.meta.dir, '..')
const artifactPath = join(root, 'libs', 'native', 'artifacts', 'todo_parser.node')

function parseOptions(argv: readonly string[]): Options {
  let target: string | null = null
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== '--target') continue
    const value = argv[index + 1]
    if (value === undefined || value.startsWith('--'))
      throw new Error('--target requires a Rust target triple')
    target = value
  }
  return { release: argv.includes('--release'), force: argv.includes('--force'), target }
}

function commandOutput(command: readonly string[]): string | null {
  const result = Bun.spawnSync({ cmd: [...command], cwd: root, stdout: 'pipe', stderr: 'ignore' })
  if (result.exitCode !== 0) return null
  return new TextDecoder().decode(result.stdout).trim()
}

function isErrnoException(value: unknown): value is NodeJS.ErrnoException {
  return value instanceof Error && 'code' in value
}

function hostTarget(): string {
  const verbose = commandOutput(['rustc', '-vV'])
  const host = verbose
    ?.split('\n')
    .find((line) => line.startsWith('host: '))
    ?.slice('host: '.length)
  if (host === undefined || host.length === 0) {
    throw new Error('Could not determine the Rust host target. Install the repository toolchain.')
  }
  return host
}

function cacheRoot(): string {
  const explicit = process.env['XDG_CACHE_HOME']
  if (explicit !== undefined) return join(explicit, 'worktree-todo-starter', 'native')
  const localAppData = process.env['LOCALAPPDATA']
  if (process.platform === 'win32' && localAppData !== undefined) {
    return join(localAppData, 'worktree-todo-starter', 'native')
  }
  return join(homedir(), '.cache', 'worktree-todo-starter', 'native')
}

async function sourceFiles(): Promise<readonly string[]> {
  const paths = [
    join(root, 'Cargo.toml'),
    join(root, 'rust-toolchain.toml'),
    join(root, 'libs', 'native', 'package.json'),
  ]
  try {
    await stat(join(root, 'Cargo.lock'))
    paths.push(join(root, 'Cargo.lock'))
  } catch {
    // A fresh template has no lockfile until the first Cargo invocation.
  }

  for (const pattern of ['**/*.rs', '**/Cargo.toml']) {
    const glob = new Bun.Glob(pattern)
    for await (const path of glob.scan({ cwd: join(root, 'crates'), absolute: true }))
      paths.push(path)
  }
  return paths.toSorted()
}

async function artifactKey(options: Options, target: string): Promise<string> {
  const hasher = new Bun.CryptoHasher('sha256')
  hasher.update(
    `version\0${VERSION}\0target\0${target}\0profile\0${options.release ? 'release' : 'debug'}\0`,
  )
  for (const path of await sourceFiles()) {
    hasher.update(`${path.slice(root.length)}\0`)
    hasher.update(await readFile(path))
    hasher.update('\0')
  }
  return hasher.digest('hex')
}

async function materialize(source: string, destination: string): Promise<void> {
  await mkdir(dirname(destination), { recursive: true })
  await rm(destination, { force: true })
  try {
    await link(source, destination)
  } catch {
    await copyFile(source, destination)
  }
}

async function findBuiltAddon(directory: string): Promise<string> {
  const matches: string[] = []
  const glob = new Bun.Glob('**/*.node')
  for await (const path of glob.scan({ cwd: directory, absolute: true })) matches.push(path)
  if (matches.length !== 1) {
    throw new Error(`Expected one .node artifact in ${directory}, found ${matches.length}`)
  }
  const match = matches[0]
  if (match === undefined) throw new Error('Native addon artifact disappeared')
  return match
}

async function acquireLock(path: string): Promise<void> {
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    try {
      await mkdir(path)
      return
    } catch (error) {
      if (!isErrnoException(error) || error.code !== 'EEXIST') throw error
      await Bun.sleep(250)
    }
  }
  throw new Error(`Timed out waiting for native build lock ${path}`)
}

async function build(
  cacheDirectory: string,
  cacheArtifact: string,
  options: Options,
  target: string,
): Promise<void> {
  const buildDirectory = join(cacheDirectory, `.build-${process.pid}-${Date.now()}`)
  await rm(buildDirectory, { recursive: true, force: true })
  await mkdir(buildDirectory, { recursive: true })

  const command = [
    'bunx',
    'napi',
    'build',
    '--cwd',
    'libs/native',
    '--manifest-path',
    '../../Cargo.toml',
    '--package',
    'todo-parser-napi',
    '--package-json-path',
    'package.json',
    '--output-dir',
    buildDirectory,
    '--platform',
    '--target',
    target,
  ]
  if (options.release) command.push('--release')

  console.log(`Building native addon for ${target} (${options.release ? 'release' : 'debug'})`)
  const processHandle = Bun.spawn(command, {
    cwd: root,
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
    env: { ...process.env, PROJECT_VERSION: VERSION },
  })
  const exitCode = await processHandle.exited
  if (exitCode !== 0) throw new Error(`napi build exited with ${exitCode}`)

  const built = await findBuiltAddon(buildDirectory)
  await copyFile(built, cacheArtifact)
  await writeFile(
    join(cacheDirectory, 'build-info.json'),
    `${JSON.stringify({ version: VERSION, target, profile: options.release ? 'release' : 'debug', source: basename(built) }, null, 2)}\n`,
  )
  await rm(buildDirectory, { recursive: true, force: true })
}

const options = parseOptions(process.argv.slice(2))
const target = options.target ?? hostTarget()
const key = await artifactKey(options, target)
const directory = join(cacheRoot(), key)
const cachedArtifact = join(directory, 'todo_parser.node')
const lockPath = `${directory}.lock`
await mkdir(cacheRoot(), { recursive: true })

let cacheHit = false
if (!options.force) {
  try {
    await stat(cachedArtifact)
    cacheHit = true
  } catch {
    cacheHit = false
  }
}

if (!cacheHit) {
  await acquireLock(lockPath)
  try {
    let builtByAnotherProcess = false
    if (!options.force) {
      try {
        await stat(cachedArtifact)
        builtByAnotherProcess = true
      } catch {
        builtByAnotherProcess = false
      }
    }
    if (!builtByAnotherProcess) {
      await mkdir(directory, { recursive: true })
      await build(directory, cachedArtifact, options, target)
    }
  } finally {
    await rm(lockPath, { recursive: true, force: true })
  }
}

await materialize(cachedArtifact, artifactPath)
console.log(
  `${cacheHit ? 'Reused' : 'Materialized'} ${artifactPath} from cache key ${key.slice(0, 12)}`,
)
