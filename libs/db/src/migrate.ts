import { runMigrations } from './migrations.ts'

const databaseUrl = process.env['DATABASE_URL']
if (databaseUrl === undefined || databaseUrl.length === 0) {
  throw new Error('DATABASE_URL is required to run migrations')
}

await runMigrations(databaseUrl)
