import { expect, test } from 'bun:test'
import { createDatabase, createTodoRepository, runMigrations } from '@starter/db'

const databaseUrl = process.env['DATABASE_URL']

if (databaseUrl === undefined) {
  test.skip('database integration tests require DATABASE_URL', () => {})
} else {
  test('persists a parsed todo in Postgres', async () => {
    await runMigrations(databaseUrl)
    const database = createDatabase(databaseUrl)
    try {
      const repository = createTodoRepository(database.db)
      const created = await repository.create({
        input: 'Integration test #ci',
        parsed: {
          title: 'Integration test',
          tags: ['ci'],
          context: null,
          priority: 'normal',
          dueDate: null,
        },
      })
      expect((await repository.find(created.id))?.title).toBe('Integration test')
      expect(await repository.delete(created.id)).toBe(true)
    } finally {
      await database.close()
    }
  })
}
