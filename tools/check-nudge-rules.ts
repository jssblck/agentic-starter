import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

type ExpectedResult = 'Continue' | 'Interrupt' | 'Passthrough' | 'Substitute'

interface Fixture {
  readonly name: string
  readonly rule: string
  readonly expected: ExpectedResult
  readonly input: 'content' | 'prompt'
  readonly fixture: string
  readonly tool?: 'Bash' | 'Write'
  readonly file?: string
}

const fixtureDirectory = join(import.meta.dirname, '..', 'tests', 'fixtures', 'nudge')
const fixtures: readonly Fixture[] = [
  {
    name: 'explicit any is blocked',
    rule: 'typescript-no-any',
    expected: 'Interrupt',
    input: 'content',
    fixture: 'typescript-any-positive.txt',
    tool: 'Write',
    file: 'sample.ts',
  },
  {
    name: 'unknown is allowed',
    rule: 'typescript-no-any',
    expected: 'Passthrough',
    input: 'content',
    fixture: 'typescript-any-negative.txt',
    tool: 'Write',
    file: 'sample.ts',
  },
  {
    name: 'non-null assertion is blocked',
    rule: 'typescript-no-non-null-assertion',
    expected: 'Interrupt',
    input: 'content',
    fixture: 'typescript-non-null-positive.txt',
    tool: 'Write',
    file: 'sample.ts',
  },
  {
    name: 'generic array type is allowed',
    rule: 'typescript-no-non-null-assertion',
    expected: 'Passthrough',
    input: 'content',
    fixture: 'typescript-non-null-negative.txt',
    tool: 'Write',
    file: 'sample.ts',
  },
  {
    name: 'checker suppression is blocked',
    rule: 'typescript-no-checker-suppression',
    expected: 'Interrupt',
    input: 'content',
    fixture: 'typescript-suppression-positive.txt',
    tool: 'Write',
    file: 'sample.ts',
  },
  {
    name: 'ordinary comment is allowed',
    rule: 'typescript-no-checker-suppression',
    expected: 'Passthrough',
    input: 'content',
    fixture: 'typescript-suppression-negative.txt',
    tool: 'Write',
    file: 'sample.ts',
  },
  {
    name: 'double cast is blocked',
    rule: 'typescript-no-double-cast',
    expected: 'Interrupt',
    input: 'content',
    fixture: 'typescript-double-cast-positive.txt',
    tool: 'Write',
    file: 'sample.ts',
  },
  {
    name: 'boundary parser is allowed',
    rule: 'typescript-no-double-cast',
    expected: 'Passthrough',
    input: 'content',
    fixture: 'typescript-double-cast-negative.txt',
    tool: 'Write',
    file: 'sample.ts',
  },
  {
    name: 'fixed eph port is blocked',
    rule: 'worktree-no-fixed-port',
    expected: 'Interrupt',
    input: 'content',
    fixture: 'eph-fixed-port-positive.txt',
    tool: 'Write',
    file: '.eph',
  },
  {
    name: 'automatic eph port is allowed',
    rule: 'worktree-no-fixed-port',
    expected: 'Passthrough',
    input: 'content',
    fixture: 'eph-fixed-port-negative.txt',
    tool: 'Write',
    file: '.eph',
  },
  {
    name: 'npm run is substituted',
    rule: 'use-pnpm-run',
    expected: 'Substitute',
    input: 'content',
    fixture: 'bash-npm-run-positive.txt',
    tool: 'Bash',
  },
  {
    name: 'pnpm run is unchanged',
    rule: 'use-pnpm-run',
    expected: 'Passthrough',
    input: 'content',
    fixture: 'bash-npm-run-negative.txt',
    tool: 'Bash',
  },
  {
    name: 'npx is substituted',
    rule: 'use-pnpm-dlx',
    expected: 'Substitute',
    input: 'content',
    fixture: 'bash-npx-positive.txt',
    tool: 'Bash',
  },
  {
    name: 'pnpm dlx is unchanged',
    rule: 'use-pnpm-dlx',
    expected: 'Passthrough',
    input: 'content',
    fixture: 'bash-npx-negative.txt',
    tool: 'Bash',
  },
  {
    name: 'bun install is substituted',
    rule: 'use-pnpm-install',
    expected: 'Substitute',
    input: 'content',
    fixture: 'bash-install-positive.txt',
    tool: 'Bash',
  },
  {
    name: 'pnpm install is unchanged',
    rule: 'use-pnpm-install',
    expected: 'Passthrough',
    input: 'content',
    fixture: 'bash-install-negative.txt',
    tool: 'Bash',
  },
]

for (const fixture of fixtures) {
  const fixturePath = join(fixtureDirectory, fixture.fixture)
  const command = ['nudge', 'test', '--rule', fixture.rule]
  if (fixture.input === 'prompt') {
    const input = readFileSync(fixturePath, 'utf8').trim()
    command.push('--prompt', input)
  } else {
    if (fixture.tool === undefined) throw new Error(`${fixture.name} requires a tool`)
    command.push('--tool', fixture.tool)
    if (fixture.tool === 'Bash') {
      command.push('--content', readFileSync(fixturePath, 'utf8').trim())
    } else {
      command.push('--content-file', fixturePath)
    }
    if (fixture.file !== undefined) command.push('--file', fixture.file)
  }

  const [executable, ...args] = command
  if (executable === undefined) throw new Error('empty command')
  const result = spawnSync(executable, args, { encoding: 'utf8' })
  const output = `${result.stdout}${result.stderr}`
  if (result.status !== 0) {
    throw new Error(`${fixture.name}: nudge test exited with ${result.status}\n${output}`)
  }
  if (!output.includes(`Result: ${fixture.expected}`)) {
    throw new Error(`${fixture.name}: expected ${fixture.expected}\n${output}`)
  }
}

console.log(`Nudge rule fixtures passed (${fixtures.length} cases)`)
