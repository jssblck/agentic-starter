import { describe, expect, test } from 'bun:test'

import cli from './cli.ts'

async function serve(argv: string[]) {
  let output = ''
  let exitCode = 0

  await cli.serve(argv, {
    env: {},
    stdout(value) {
      output += value
    },
    exit(code) {
      exitCode = code
    },
  })

  return { exitCode, output }
}

describe('todo-server', () => {
  test('provides help without requiring server environment', async () => {
    const result = await serve(['--help'])

    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('Usage: todo-server')
    expect(result.output).toContain('DATABASE_URL')
  })

  test('provides version without starting the server', async () => {
    const result = await serve(['--version'])

    expect(result.exitCode).toBe(0)
    expect(result.output.trim()).toMatch(/^0\.0\.0/)
  })
})
