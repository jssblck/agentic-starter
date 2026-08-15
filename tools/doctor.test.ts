import { describe, expect, test } from 'vitest'

import { assessProbe, parseRequiredNodeMajor, parseRequiredPnpm, type ToolProbe } from './doctor.ts'

describe('doctor requirements', () => {
  test('reads the pnpm pin from package.json', () => {
    expect(parseRequiredPnpm({ packageManager: 'pnpm@11.21.0' })).toBe('11.21.0')
  })

  test('rejects an unpinned package manager', () => {
    expect(() => parseRequiredPnpm({ packageManager: 'pnpm@latest' })).toThrow(
      'package.json packageManager must pin pnpm as pnpm@X.Y.Z',
    )
  })

  test('reads the Node major from engines', () => {
    expect(parseRequiredNodeMajor({ engines: { node: '>=24' } })).toBe(24)
  })
})

describe('doctor probe assessment', () => {
  const requiredPnpm: ToolProbe = {
    name: 'pnpm',
    command: ['pnpm', '--version'],
    required: true,
    expectedVersion: '11.21.0',
  }

  test('accepts the pinned version', () => {
    expect(assessProbe(requiredPnpm, { ok: true, output: '11.21.0' })).toEqual({
      state: 'ok',
      output: '11.21.0',
      failed: false,
    })
  })

  test('rejects a different installed version', () => {
    expect(assessProbe(requiredPnpm, { ok: true, output: '10.5.0' })).toEqual({
      state: 'mismatch',
      output: '10.5.0 (requires 11.21.0)',
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
