import { createApp } from '@starter/api/server'
import { createDatabase, createTodoRepository } from '@starter/db'
import { createNativeTodoParser } from '@starter/native'
import { VERSION } from '@starter/version'
import { Cli, z } from 'incur'

const cli = Cli.create('todo-server', {
  version: VERSION,
  description: 'Run the Worktree Todo HTTP API.',
  env: z.object({
    DATABASE_URL: z.string().min(1).describe('Postgres connection URL'),
    HOST: z.string().default('0.0.0.0').describe('HTTP listen host'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000).describe('HTTP listen port'),
    LOG_LEVEL: z
      .enum(['debug', 'info', 'warn', 'error'])
      .default('info')
      .describe('Server log level'),
  }),
  output: z.object({
    version: z.string(),
    url: z.string().url(),
  }),
  async run({ env }) {
    const database = createDatabase(env.DATABASE_URL)
    const parser = createNativeTodoParser()
    const app = createApp({ todos: createTodoRepository(database.db), parser })
    const url = `http://${env.HOST}:${env.PORT}`

    app.listen({ hostname: env.HOST, port: env.PORT })

    async function shutdown(): Promise<void> {
      await database.close()
      await app.stop()
    }

    process.once('SIGINT', () => {
      void shutdown()
    })
    process.once('SIGTERM', () => {
      void shutdown()
    })

    return { version: VERSION, url }
  },
})

export default cli
