import { readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
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

export function parseRequiredPnpm(packageJson: unknown): string {
  if (!isRecord(packageJson) || typeof packageJson['packageManager'] !== 'string') {
    throw new Error('package.json packageManager must pin pnpm as pnpm@X.Y.Z')
  }
  const match = /^pnpm@(\d+\.\d+\.\d+)$/.exec(packageJson['packageManager'])
  const pnpm = match?.[1]
  if (pnpm === undefined) throw new Error('package.json packageManager must pin pnpm as pnpm@X.Y.Z')
  return pnpm
}

export function parseRequiredNodeMajor(packageJson: unknown): number {
  if (!isRecord(packageJson) || !isRecord(packageJson['engines'])) {
    throw new Error('package.json engines.node must be set')
  }
  const node = packageJson['engines']['node']
  const match = typeof node === 'string' ? /^>=(\d+)/.exec(node) : null
  const major = match?.[1]
  if (major === undefined) throw new Error('package.json engines.node must look like ">=24"')
  return Number(major)
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

function probe(tool: ToolProbe): Promise<ProbeOutput> {
  return new Promise((resolve) => {
    const [command, ...args] = tool.command
    if (command === undefined) {
      resolve({ ok: false, output: 'no command' })
      return
    }
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString()
    })
    child.stderr.on('data', (chunk: Buffer) => {
      output += chunk.toString()
    })
    child.on('error', (error) => resolve({ ok: false, output: error.message }))
    child.on('close', (code) =>
      resolve({ ok: code === 0, output: output.trim().split('\n')[0] ?? '' }),
    )
  })
}

async function main(): Promise<void> {
  const root = join(import.meta.dirname, '..')
  const packageJson: unknown = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
  const pnpm = parseRequiredPnpm(packageJson)
  const nodeMajor = parseRequiredNodeMajor(packageJson)
  const probes: readonly ToolProbe[] = [
    { name: 'git', command: ['git', '--version'], required: true },
    { name: 'node', command: ['node', '--version'], required: true },
    { name: 'pnpm', command: ['pnpm', '--version'], required: true, expectedVersion: pnpm },
    { name: 'docker', command: ['docker', '--version'], required: false },
    { name: 'eph', command: ['eph', '--version'], required: true },
    { name: 'sops', command: ['sops', '--version', '--disable-version-check'], required: true },
    { name: 'age', command: ['age-keygen', '--version'], required: false },
    { name: 'nudge', command: ['nudge', '--version'], required: false },
    { name: 'bastion', command: ['bastion', '--version'], required: false },
  ]

  let failed = false
  for (const tool of probes) {
    const assessment = assessProbe(tool, await probe(tool))
    let line = `${assessment.state.padEnd(8)} ${tool.name.padEnd(10)} ${assessment.output}`
    if (tool.name === 'node' && assessment.state === 'ok') {
      const major = Number(detectedVersion(assessment.output)?.split('.')[0])
      if (major < nodeMajor) {
        line = `mismatch node       ${assessment.output} (requires >=${nodeMajor})`
        failed = true
      }
    }
    console.log(line)
    if (assessment.failed) failed = true
  }

  if (failed) {
    console.error('\nOne or more required tools are missing or incompatible. See README.md.')
    process.exitCode = 1
  }
}

if (process.argv[1] !== undefined && import.meta.filename === process.argv[1]) await main()
