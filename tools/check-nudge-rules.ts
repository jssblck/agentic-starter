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

const fixtureDirectory = join(import.meta.dir, '..', 'tests', 'fixtures', 'nudge')
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
    name: 'manual React memoization is blocked',
    rule: 'react-no-manual-memoization',
    expected: 'Interrupt',
    input: 'content',
    fixture: 'react-manual-memo-positive.txt',
    tool: 'Write',
    file: 'sample.tsx',
  },
  {
    name: 'compiler-era component is allowed',
    rule: 'react-no-manual-memoization',
    expected: 'Passthrough',
    input: 'content',
    fixture: 'react-manual-memo-negative.txt',
    tool: 'Write',
    file: 'sample.tsx',
  },
  {
    name: 'Rust unwrap is blocked',
    rule: 'rust-no-unwrap',
    expected: 'Interrupt',
    input: 'content',
    fixture: 'rust-unwrap-positive.txt',
    tool: 'Write',
    file: 'sample.rs',
  },
  {
    name: 'Rust expect is allowed',
    rule: 'rust-no-unwrap',
    expected: 'Passthrough',
    input: 'content',
    fixture: 'rust-unwrap-negative.txt',
    tool: 'Write',
    file: 'sample.rs',
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
    rule: 'use-bun-run',
    expected: 'Substitute',
    input: 'content',
    fixture: 'bash-npm-run-positive.txt',
    tool: 'Bash',
  },
  {
    name: 'bun run is unchanged',
    rule: 'use-bun-run',
    expected: 'Passthrough',
    input: 'content',
    fixture: 'bash-npm-run-negative.txt',
    tool: 'Bash',
  },
  {
    name: 'npx is substituted',
    rule: 'use-bunx',
    expected: 'Substitute',
    input: 'content',
    fixture: 'bash-npx-positive.txt',
    tool: 'Bash',
  },
  {
    name: 'bunx is unchanged',
    rule: 'use-bunx',
    expected: 'Passthrough',
    input: 'content',
    fixture: 'bash-npx-negative.txt',
    tool: 'Bash',
  },
  {
    name: 'schema prompts receive context',
    rule: 'schema-change-reminder',
    expected: 'Continue',
    input: 'prompt',
    fixture: 'prompt-schema-positive.txt',
  },
  {
    name: 'unrelated prompts are unchanged',
    rule: 'schema-change-reminder',
    expected: 'Passthrough',
    input: 'prompt',
    fixture: 'prompt-schema-negative.txt',
  },
]

for (const fixture of fixtures) {
  const fixturePath = join(fixtureDirectory, fixture.fixture)
  const command = ['nudge', 'test', '--rule', fixture.rule]
  if (fixture.input === 'prompt') {
    const input = (await Bun.file(fixturePath).text()).trim()
    command.push('--prompt', input)
  } else {
    if (fixture.tool === undefined) throw new Error(`${fixture.name} requires a tool`)
    command.push('--tool', fixture.tool)
    if (fixture.tool === 'Bash') {
      command.push('--content', (await Bun.file(fixturePath).text()).trim())
    } else {
      command.push('--content-file', fixturePath)
    }
    if (fixture.file !== undefined) command.push('--file', fixture.file)
  }

  const result = Bun.spawnSync({ cmd: command, stdout: 'pipe', stderr: 'pipe' })
  const output = `${new TextDecoder().decode(result.stdout)}${new TextDecoder().decode(result.stderr)}`
  if (result.exitCode !== 0) {
    throw new Error(`${fixture.name}: nudge test exited with ${result.exitCode}\n${output}`)
  }
  if (!output.includes(`Result: ${fixture.expected}`)) {
    throw new Error(`${fixture.name}: expected ${fixture.expected}\n${output}`)
  }
}

console.log(`Nudge rule fixtures passed (${fixtures.length} cases)`)
