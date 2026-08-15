// Wrapper over sops for the encrypted dotenv files in secrets/.
//
//   secrets init <env>                  create secrets/<env>.env from .sops.yaml recipients
//   secrets get <env> <KEY>             print one value
//   secrets set <env> <KEY> <value>     add or replace one value
//   secrets unset <env> <KEY>           remove one value
//   secrets show <env>                  print the decrypted file
//   secrets edit <env>                  open the decrypted file in $EDITOR
//   secrets exec <env> -- <command...>  run a command with the decrypted values in its environment
//   secrets elevate                     read an age identity from stdin into .age/elevated
//
// sops unions every identity it can find: the user key file, SOPS_AGE_KEY, and
// SOPS_AGE_KEY_FILE. `elevate` stores an identity in this checkout so later
// commands here can decrypt files that identity is a recipient of. Delete
// .age/elevated to drop it. See docs/secrets.md.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const elevatedPath = resolve(root, '.age/elevated')

export function secretsFile(env: string): string {
  return `secrets/${env}.env`
}

/** Environment for sops itself: adds the elevated identity when present. */
export function sopsEnvironment(
  base: NodeJS.ProcessEnv,
  elevated: string | undefined,
): NodeJS.ProcessEnv {
  return elevated === undefined ? { ...base } : { ...base, SOPS_AGE_KEY_FILE: elevated }
}

/** Environment for the executed command: decrypted values win, age identities are removed. */
export function childEnvironment(
  base: NodeJS.ProcessEnv,
  secrets: Readonly<Record<string, string>>,
): NodeJS.ProcessEnv {
  const { SOPS_AGE_KEY: _key, SOPS_AGE_KEY_FILE: _file, ...rest } = base
  return { ...rest, ...secrets }
}

export function parseDecrypted(json: string): Record<string, string> {
  const parsed: unknown = JSON.parse(json)
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('sops did not return an object')
  }
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === 'string') out[key] = value
  }
  return out
}

function usage(): never {
  console.error(
    'usage: secrets init|show|edit <env> | get <env> <KEY> | set <env> <KEY> <value> | unset <env> <KEY> | exec <env> -- <command...> | elevate',
  )
  process.exit(2)
}

function runSops(args: readonly string[], input?: string): never {
  const result = spawnSync('sops', args, {
    cwd: root,
    env: sopsEnvironment(process.env, existsSync(elevatedPath) ? elevatedPath : undefined),
    stdio: input === undefined ? 'inherit' : ['pipe', 'inherit', 'inherit'],
    input,
  })
  if (result.error) {
    console.error(`sops: ${result.error.message}`)
    process.exit(1)
  }
  process.exit(result.status ?? 1)
}

function decrypt(env: string): Record<string, string> {
  const result = spawnSync('sops', ['decrypt', '--output-type', 'json', secretsFile(env)], {
    cwd: root,
    env: sopsEnvironment(process.env, existsSync(elevatedPath) ? elevatedPath : undefined),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  if (result.error) {
    console.error(`sops: ${result.error.message}`)
    process.exit(1)
  }
  if (result.status !== 0) process.exit(result.status ?? 1)
  return parseDecrypted(result.stdout)
}

function elevate(): void {
  const chunks: Buffer[] = []
  process.stdin.on('data', (chunk: Buffer) => chunks.push(chunk))
  process.stdin.on('end', () => {
    const identity = Buffer.concat(chunks).toString('utf8').trim()
    if (!identity.startsWith('AGE-SECRET-KEY-')) {
      console.error('elevate: expected an age identity (AGE-SECRET-KEY-...) on stdin')
      process.exit(1)
    }
    mkdirSync(resolve(root, '.age'), { recursive: true })
    writeFileSync(elevatedPath, `${identity}\n`, { mode: 0o600 })
    console.log(`elevated: wrote ${elevatedPath}`)
  })
}

function exec(env: string, rest: readonly string[]): void {
  const separator = rest.indexOf('--')
  const [command, ...args] = separator === -1 ? [] : rest.slice(separator + 1)
  if (command === undefined) usage()
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: childEnvironment(process.env, decrypt(env)),
    stdio: 'inherit',
  })
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
    process.on(signal, () => child.kill(signal))
  }
  child.on('error', (error) => {
    console.error(`${command}: ${error.message}`)
    process.exit(1)
  })
  child.on('exit', (code, signal) => {
    process.exit(code ?? (signal === null ? 1 : 128 + 15))
  })
}

function main(): void {
  const [command, env, ...rest] = process.argv.slice(2)
  if (command === 'elevate') {
    elevate()
    return
  }
  if (command === undefined || env === undefined) usage()
  const file = secretsFile(env)
  const key = rest[0]
  switch (command) {
    case 'init':
      if (existsSync(resolve(root, file))) {
        console.error(`${file} already exists`)
        process.exit(1)
      }
      runSops(
        ['encrypt', '--filename-override', file, '--output', file],
        `# ${env} secrets. Edit with: pnpm secrets set ${env} KEY value\n`,
      )
    case 'show':
      runSops(['decrypt', file])
    case 'edit':
      runSops(['edit', file])
    case 'get':
      if (key === undefined) usage()
      runSops(['decrypt', '--extract', JSON.stringify([key]), file])
    case 'set':
      if (key === undefined || rest[1] === undefined) usage()
      runSops(['set', file, JSON.stringify([key]), JSON.stringify(rest[1])])
    case 'unset':
      if (key === undefined) usage()
      runSops(['unset', file, JSON.stringify([key])])
    case 'exec':
      exec(env, rest)
      return
    default:
      usage()
  }
}

if (process.argv[1] !== undefined && import.meta.filename === process.argv[1]) main()
