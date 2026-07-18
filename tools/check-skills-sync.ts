import { Buffer } from 'node:buffer'
import { join } from 'node:path'

// Claude Code reads .claude/skills and AGENTS.md-based agents read
// .agents/skills. Neither directory can be removed, so an edit that lands in
// only one gives the two ecosystems silently different instructions.
const roots = ['.claude/skills', '.agents/skills'] as const
const repositoryRoot = join(import.meta.dir, '..')

async function listFiles(root: string): Promise<readonly string[]> {
  const files: string[] = []
  const glob = new Bun.Glob('**')
  for await (const file of glob.scan({ cwd: join(repositoryRoot, root), dot: true })) {
    files.push(file)
  }
  return files.toSorted()
}

const [claudeFiles, agentsFiles] = await Promise.all([listFiles(roots[0]), listFiles(roots[1])])
const claudeSet = new Set(claudeFiles)
const agentsSet = new Set(agentsFiles)

const problems: string[] = []
for (const file of claudeFiles) {
  if (!agentsSet.has(file)) problems.push(`${roots[1]}/${file} is missing`)
}
for (const file of agentsFiles) {
  if (!claudeSet.has(file)) problems.push(`${roots[0]}/${file} is missing`)
}

for (const file of claudeFiles) {
  if (!agentsSet.has(file)) continue
  const [left, right] = await Promise.all([
    Bun.file(join(repositoryRoot, roots[0], file)).bytes(),
    Bun.file(join(repositoryRoot, roots[1], file)).bytes(),
  ])
  if (Buffer.compare(left, right) !== 0) {
    problems.push(`${file} differs between ${roots[0]} and ${roots[1]}`)
  }
}

if (problems.length > 0) {
  throw new Error(
    `Skill directories are out of sync; copy the edited files to the mirror directory:\n${problems.join('\n')}`,
  )
}

console.log(`Skill directories are identical across ${roots.join(' and ')}`)
