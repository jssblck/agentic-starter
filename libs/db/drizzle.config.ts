import { defineConfig } from 'drizzle-kit'

const databaseUrl = process.env['DATABASE_URL']

export default defineConfig({
  dialect: 'postgresql',
  schema: './libs/db/src/schema.ts',
  out: './libs/db/drizzle',
  strict: true,
  verbose: true,
  ...(databaseUrl === undefined ? {} : { dbCredentials: { url: databaseUrl } }),
})
