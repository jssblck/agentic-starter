import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from './schema.ts'

export function createDatabase(databaseUrl: string) {
  const client = postgres(databaseUrl, {
    max: 10,
    prepare: false,
  })
  const db = drizzle(client, { schema })

  return {
    db,
    client,
    async close(): Promise<void> {
      await client.end({ timeout: 5 })
    },
  }
}

export type Database = ReturnType<typeof createDatabase>['db']
