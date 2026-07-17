import { access } from 'node:fs/promises'
import { join } from 'node:path'

interface RequiredVersions {
  readonly bun: string
  readonly rust: string
}

export interface ToolProbe {
  readonly name: string
  readonly command: readonly string[]
  readonly required: boolean
  readonly expectedVersion?: string
}

export interface ProbeOutput {
  readonly ok: boolean
  readonly output: string
}

export interface ProbeAssessment {
  readonly state: 'mismatch' | 'missing' | 'ok' | 'optional'
  readonly output: string
  readonly failed: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseRequiredVersions(
  packageJson: unknown,
  rustToolchain: string,
): RequiredVersions {
  if (!isRecord(packageJson) || typeof packageJson['packageManager'] !== 'string') {
    throw new Error('package.json packageManager must pin Bun as bun@X.Y.Z')
  }
  const bunMatch = /^bun@(\d+\.\d+\.\d+)$/.exec(packageJson['packageManager'])
  if (bunMatch === null) throw new Error('package.json packageManager must pin Bun as bun@X.Y.Z')
  const bun = bunMatch[1]
  if (bun === undefined) throw new Error('Could not read the pinned Bun version')

  const rustMatch = /^channel\s*=\s*"(\d+\.\d+\.\d+)"\s*$/m.exec(rustToolchain)
  if (rustMatch === null) throw new Error('rust-toolchain.toml must pin channel to X.Y.Z')
  const rust = rustMatch[1]
  if (rust === undefined) throw new Error('Could not read the pinned Rust version')

  return { bun, rust }
}

function detectedVersion(output: string): string | null {
  return /\b\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?\b/.exec(output)?.[0] ?? null
}

export function assessProbe(tool: ToolProbe, result: ProbeOutput): ProbeAssessment {
  if (!result.ok) {
    return {
      state: tool.required ? 'missing' : 'optional',
      output: result.output,
      failed: tool.required,
    }
  }

  if (tool.expectedVersion !== undefined) {
    const detected = detectedVersion(result.output)
    if (detected !== tool.expectedVersion) {
      return {
        state: 'mismatch',
        output: `${result.output} (requires ${tool.expectedVersion})`,
        failed: true,
      }
    }
  }

  return { state: 'ok', output: result.output, failed: false }
}

async function probe(tool: ToolProbe): Promise<ProbeOutput> {
  try {
    const process = Bun.spawn([...tool.command], { stdout: 'pipe', stderr: 'pipe' })
    const [exitCode, stdout, stderr] = await Promise.all([
      process.exited,
      new Response(process.stdout).text(),
      new Response(process.stderr).text(),
    ])
    const output = `${stdout}${stderr}`.trim().split('\n')[0] ?? ''
    return { ok: exitCode === 0, output }
  } catch (error) {
    return { ok: false, output: error instanceof Error ? error.message : 'not found' }
  }
}

async function main(): Promise<void> {
  const root = join(import.meta.dir, '..')
  const packageJson: unknown = JSON.parse(await Bun.file(join(root, 'package.json')).text())
  const required = parseRequiredVersions(
    packageJson,
    await Bun.file(join(root, 'rust-toolchain.toml')).text(),
  )
  const probes: readonly ToolProbe[] = [
    { name: 'git', command: ['git', '--version'], required: true },
    { name: 'bun', command: ['bun', '--version'], required: true, expectedVersion: required.bun },
    {
      name: 'rustc',
      command: ['rustc', '--version'],
      required: true,
      expectedVersion: required.rust,
    },
    {
      name: 'cargo',
      command: ['cargo', '--version'],
      required: true,
      expectedVersion: required.rust,
    },
    { name: 'docker', command: ['docker', '--version'], required: true },
    { name: 'eph', command: ['eph', '--version'], required: true },
    { name: 'nudge', command: ['nudge', '--version'], required: false },
    { name: 'bastion', command: ['bastion', '--version'], required: false },
  ]

  let failed = false
  for (const tool of probes) {
    const assessment = assessProbe(tool, await probe(tool))
    console.log(`${assessment.state.padEnd(8)} ${tool.name.padEnd(10)} ${assessment.output}`)
    if (assessment.failed) failed = true
  }

  const nativeArtifact = join(root, 'libs', 'native', 'artifacts', 'todo_parser.node')
  try {
    await access(nativeArtifact)
    console.log('ok       native     libs/native/artifacts/todo_parser.node')
  } catch {
    console.log('optional native     run `bun run native:ensure` before native integration work')
  }

  if (failed) {
    console.error(
      '\nOne or more required tools are missing or incompatible. See docs/getting-started.md.',
    )
    process.exitCode = 1
  }
}

if (import.meta.main) await main()
