import { basename, join } from 'node:path'

import postgres from 'postgres'

interface AppliedMigration {
  readonly name: string
  readonly checksum: string
}

async function checksum(content: string): Promise<string> {
  const bytes = new TextEncoder().encode(content)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function runMigrations(databaseUrl: string): Promise<void> {
  const sql = postgres(databaseUrl, { max: 1, prepare: false })
  const migrationsDirectory = join(import.meta.dir, '..', 'drizzle')

  try {
    await sql`select pg_advisory_lock(hashtext('agentic-starter:migrations'))`
    await sql`
      create table if not exists starter_migrations (
        name text primary key,
        checksum text not null,
        applied_at timestamptz not null default now()
      )
    `

    const appliedRows = await sql<AppliedMigration[]>`
      select name, checksum from starter_migrations order by name
    `
    const applied = new Map(appliedRows.map((migration) => [migration.name, migration.checksum]))

    const migrationFiles: string[] = []
    const glob = new Bun.Glob('*.sql')
    for await (const file of glob.scan({ cwd: migrationsDirectory, absolute: true })) {
      migrationFiles.push(file)
    }
    migrationFiles.sort()

    for (const migrationPath of migrationFiles) {
      const name = basename(migrationPath)
      const content = await Bun.file(migrationPath).text()
      const migrationChecksum = await checksum(content)
      const recordedChecksum = applied.get(name)

      if (recordedChecksum !== undefined) {
        if (recordedChecksum !== migrationChecksum) {
          throw new Error(`Applied migration ${name} has been modified`)
        }
        continue
      }

      await sql.begin(async (transaction) => {
        await transaction.unsafe(content)
        await transaction`
          insert into starter_migrations (name, checksum)
          values (${name}, ${migrationChecksum})
        `
      })
      console.log(`Applied ${name}`)
    }
  } finally {
    try {
      await sql`select pg_advisory_unlock(hashtext('agentic-starter:migrations'))`
    } finally {
      await sql.end({ timeout: 5 })
    }
  }
}
