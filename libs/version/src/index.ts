import { GENERATED_COMMIT, GENERATED_TAG, GENERATED_VERSION } from './generated.ts'

const releaseTagPattern = /^v(\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?)$/
const releaseVersionPattern = /^(\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?)$/

export interface VersionInfo {
  readonly version: string
  readonly tag: string | null
  readonly commit: string
  readonly dirty: boolean
  readonly source: 'environment' | 'generated' | 'tag' | 'commit' | 'unknown'
}

function normalizeReleaseVersion(value: string | undefined): string | null {
  if (value === undefined) return null

  const trimmed = value.trim()
  const tagMatch = releaseTagPattern.exec(trimmed)
  if (tagMatch?.[1] !== undefined) return tagMatch[1]
  if (releaseVersionPattern.test(trimmed)) return trimmed

  throw new Error(
    `PROJECT_VERSION must be a semantic version or v-prefixed tag, received ${trimmed}`,
  )
}

function runGit(args: readonly string[]): string | null {
  try {
    const result = Bun.spawnSync({
      cmd: ['git', ...args],
      stdout: 'pipe',
      stderr: 'ignore',
    })

    if (result.exitCode !== 0) return null
    return new TextDecoder().decode(result.stdout).trim()
  } catch {
    return null
  }
}

export function resolveVersionInfo(): VersionInfo {
  const environmentVersion = normalizeReleaseVersion(process.env['PROJECT_VERSION'])
  if (environmentVersion !== null) {
    return {
      version: environmentVersion,
      tag: `v${environmentVersion}`,
      commit: process.env['GITHUB_SHA']?.slice(0, 12) ?? GENERATED_COMMIT,
      dirty: false,
      source: 'environment',
    }
  }

  if (GENERATED_VERSION !== '0.0.0') {
    return {
      version: GENERATED_VERSION,
      tag: GENERATED_TAG,
      commit: GENERATED_COMMIT,
      dirty: false,
      source: 'generated',
    }
  }

  const exactTag = runGit(['describe', '--tags', '--exact-match', '--match', 'v[0-9]*'])
  if (exactTag !== null) {
    const match = releaseTagPattern.exec(exactTag)
    if (match?.[1] !== undefined) {
      return {
        version: match[1],
        tag: exactTag,
        commit: runGit(['rev-parse', '--short=12', 'HEAD']) ?? 'unknown',
        dirty: false,
        source: 'tag',
      }
    }
  }

  const commit = runGit(['rev-parse', '--short=12', 'HEAD'])
  if (commit !== null) {
    const dirty = (runGit(['status', '--porcelain', '--untracked-files=no']) ?? '').length > 0
    return {
      version: `0.0.0+g${commit}${dirty ? '.dirty' : ''}`,
      tag: null,
      commit,
      dirty,
      source: 'commit',
    }
  }

  return {
    version: '0.0.0+unknown',
    tag: null,
    commit: 'unknown',
    dirty: false,
    source: 'unknown',
  }
}

export const VERSION_INFO = resolveVersionInfo()
export const VERSION = VERSION_INFO.version

export function versionPayload(): {
  readonly version: string
  readonly tag: string | null
  readonly commit: string
} {
  return {
    version: VERSION_INFO.version,
    tag: VERSION_INFO.tag,
    commit: VERSION_INFO.commit,
  }
}
