import { describe, expect, test } from 'bun:test'

import { assessProbe, parseRequiredVersions, type ToolProbe } from './doctor.ts'

describe('doctor requirements', () => {
  test('reads the Bun and Rust pins from repository config', () => {
    expect(
      parseRequiredVersions({ packageManager: 'bun@1.3.14' }, '[toolchain]\nchannel = "1.97.1"\n'),
    ).toEqual({ bun: '1.3.14', rust: '1.97.1' })
  })

  test('rejects an unpinned Bun package manager', () => {
    expect(() =>
      parseRequiredVersions({ packageManager: 'bun@latest' }, 'channel = "1.97.1"'),
    ).toThrow('package.json packageManager must pin Bun as bun@X.Y.Z')
  })
})

describe('doctor probe assessment', () => {
  const requiredBun: ToolProbe = {
    name: 'bun',
    command: ['bun', '--version'],
    required: true,
    expectedVersion: '1.3.14',
  }

  test('accepts the pinned version', () => {
    expect(assessProbe(requiredBun, { ok: true, output: '1.3.14' })).toEqual({
      state: 'ok',
      output: '1.3.14',
      failed: false,
    })
  })

  test('rejects a different installed version', () => {
    expect(assessProbe(requiredBun, { ok: true, output: '1.3.6' })).toEqual({
      state: 'mismatch',
      output: '1.3.6 (requires 1.3.14)',
      failed: true,
    })
  })

  test('keeps an unavailable optional tool non-fatal', () => {
    const optionalTool: ToolProbe = {
      name: 'bastion',
      command: ['bastion', '--version'],
      required: false,
    }
    expect(assessProbe(optionalTool, { ok: false, output: 'not found' })).toEqual({
      state: 'optional',
      output: 'not found',
      failed: false,
    })
  })
})
