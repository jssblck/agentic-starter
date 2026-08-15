import { describe, expect, test } from 'vitest'

import { childEnvironment, parseDecrypted, secretsFile, sopsEnvironment } from './secrets.ts'

describe('secrets wrapper', () => {
  test('maps an environment name to its file', () => {
    expect(secretsFile('prod')).toBe('secrets/prod.env')
  })

  test('adds the elevated identity file only when present', () => {
    expect(sopsEnvironment({ HOME: '/home/ada' }, undefined)).toEqual({ HOME: '/home/ada' })
    expect(sopsEnvironment({ HOME: '/home/ada' }, '/repo/.age/elevated')).toEqual({
      HOME: '/home/ada',
      SOPS_AGE_KEY_FILE: '/repo/.age/elevated',
    })
  })

  test('child environment prefers decrypted values and drops age identities', () => {
    const env = childEnvironment(
      {
        HOME: '/home/ada',
        DATABASE_URL: 'from-shell',
        SOPS_AGE_KEY: 'AGE-SECRET-KEY-1',
        SOPS_AGE_KEY_FILE: '/x',
      },
      { DATABASE_URL: 'from-sops', API_KEY: 'k' },
    )
    expect(env).toEqual({ HOME: '/home/ada', DATABASE_URL: 'from-sops', API_KEY: 'k' })
  })

  test('parses the sops JSON output and keeps only string values', () => {
    expect(parseDecrypted('{"A":"1","B":2,"C":"x"}')).toEqual({ A: '1', C: 'x' })
    expect(() => parseDecrypted('[]')).toThrow('sops did not return an object')
  })
})
