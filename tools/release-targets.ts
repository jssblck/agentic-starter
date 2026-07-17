export interface ReleaseTarget {
  readonly runner: string
  readonly rust: string
  readonly bun: string
  readonly triple: string
  readonly executable: string
  readonly format: 'tar' | 'zip'
}

export const RELEASE_TARGETS: Readonly<Record<string, ReleaseTarget>> = {
  'linux-x64': {
    runner: 'ubuntu-24.04',
    rust: 'x86_64-unknown-linux-gnu',
    bun: 'bun-linux-x64-baseline',
    triple: 'x86_64-unknown-linux-gnu',
    executable: 'todoctl',
    format: 'tar',
  },
  'linux-arm64': {
    runner: 'ubuntu-24.04-arm',
    rust: 'aarch64-unknown-linux-gnu',
    bun: 'bun-linux-arm64',
    triple: 'aarch64-unknown-linux-gnu',
    executable: 'todoctl',
    format: 'tar',
  },
  'macos-x64': {
    runner: 'macos-15-intel',
    rust: 'x86_64-apple-darwin',
    bun: 'bun-darwin-x64',
    triple: 'x86_64-apple-darwin',
    executable: 'todoctl',
    format: 'tar',
  },
  'macos-arm64': {
    runner: 'macos-15',
    rust: 'aarch64-apple-darwin',
    bun: 'bun-darwin-arm64',
    triple: 'aarch64-apple-darwin',
    executable: 'todoctl',
    format: 'tar',
  },
  'windows-x64': {
    runner: 'windows-2025',
    rust: 'x86_64-pc-windows-msvc',
    bun: 'bun-windows-x64-baseline',
    triple: 'x86_64-pc-windows-msvc',
    executable: 'todoctl.exe',
    format: 'zip',
  },
}
