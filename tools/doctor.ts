import { join } from 'node:path'

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

export function parseRequiredBun(packageJson: unknown): string {
  if (!isRecord(packageJson) || typeof packageJson['packageManager'] !== 'string') {
    throw new Error('package.json packageManager must pin Bun as bun@X.Y.Z')
  }
  const match = /^bun@(\d+\.\d+\.\d+)$/.exec(packageJson['packageManager'])
  const bun = match?.[1]
  if (bun === undefined) throw new Error('package.json packageManager must pin Bun as bun@X.Y.Z')
  return bun
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
  const bun = parseRequiredBun(packageJson)
  const probes: readonly ToolProbe[] = [
    { name: 'git', command: ['git', '--version'], required: true },
    { name: 'bun', command: ['bun', '--version'], required: true, expectedVersion: bun },
    { name: 'docker', command: ['docker', '--version'], required: false },
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

  if (failed) {
    console.error('\nOne or more required tools are missing or incompatible. See README.md.')
    process.exitCode = 1
  }
}

if (import.meta.main) await main()
