import { join } from 'node:path'

const root = join(import.meta.dir, '..')
const semanticVersionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function packageManifestPaths(): Promise<readonly string[]> {
  const paths = [join(root, 'package.json')]
  for (const directory of ['bins', 'libs']) {
    const glob = new Bun.Glob('*/package.json')
    for await (const path of glob.scan({ cwd: join(root, directory), absolute: true }))
      paths.push(path)
  }
  return paths.toSorted()
}

const versions = new Map<string, string>()
for (const path of await packageManifestPaths()) {
  const parsed: unknown = JSON.parse(await Bun.file(path).text())
  if (
    !isRecord(parsed) ||
    typeof parsed['name'] !== 'string' ||
    typeof parsed['version'] !== 'string'
  ) {
    throw new Error(`${path} lacks a string name or version`)
  }
  versions.set(parsed['name'], parsed['version'])
}

const uniqueVersions = new Set(versions.values())
if (uniqueVersions.size !== 1) {
  throw new Error(
    `Workspace package versions differ: ${JSON.stringify(Object.fromEntries(versions))}`,
  )
}
const workspaceVersion = uniqueVersions.values().next().value
if (typeof workspaceVersion !== 'string' || !semanticVersionPattern.test(workspaceVersion)) {
  throw new Error(`Workspace version is not release-shaped: ${workspaceVersion ?? 'missing'}`)
}

const bunLock = await Bun.file(join(root, 'bun.lock')).text()
const packagesMarker = '\n  "packages": {'
const packagesIndex = bunLock.indexOf(packagesMarker)
if (packagesIndex === -1) throw new Error('bun.lock has no packages section')
const lockVersions = Array.from(
  bunLock.slice(0, packagesIndex).matchAll(/"version": "([^"]+)"/g),
  (match) => match[1],
)
if (lockVersions.length === 0 || lockVersions.some((version) => version !== workspaceVersion)) {
  throw new Error(
    `bun.lock workspace versions differ from ${workspaceVersion}: ${JSON.stringify(lockVersions)}`,
  )
}

const cargo = await Bun.file(join(root, 'Cargo.toml')).text()
const cargoMatch = /\[workspace\.package\][\s\S]*?\nversion = "([^"]+)"/.exec(cargo)
if (cargoMatch?.[1] !== workspaceVersion) {
  throw new Error(
    `Cargo workspace version ${cargoMatch?.[1] ?? 'missing'} differs from ${workspaceVersion}`,
  )
}

const generated = await Bun.file(join(root, 'libs', 'version', 'src', 'generated.ts')).text()
const generatedMatch = /GENERATED_VERSION = ['"]([^'"]+)['"]/.exec(generated)
if (generatedMatch?.[1] !== workspaceVersion) {
  throw new Error(
    `Generated TypeScript version ${generatedMatch?.[1] ?? 'missing'} differs from ${workspaceVersion}`,
  )
}

const tagResult = Bun.spawnSync({
  cmd: ['git', 'describe', '--tags', '--exact-match', '--match', 'v[0-9]*'],
  cwd: root,
  stdout: 'pipe',
  stderr: 'ignore',
})
if (tagResult.exitCode === 0) {
  const tag = new TextDecoder().decode(tagResult.stdout).trim()
  if (tag !== `v${workspaceVersion}`) {
    throw new Error(`Exact Git tag ${tag} differs from workspace version v${workspaceVersion}`)
  }
}

console.log(`All package, Cargo, and generated versions agree on ${workspaceVersion}`)
