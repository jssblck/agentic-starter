import { type TodoApi, TodoApiClient } from '@starter/api'
import type { TodoParser } from '@starter/native'
import { createNativeTodoParser } from '@starter/native'
import { VERSION } from '@starter/version'
import { Cli, z } from 'incur'

const todoPrioritySchema = z.enum(['low', 'normal', 'high', 'urgent'])
const parsedTodoSchema = z.object({
  title: z.string(),
  tags: z.array(z.string()),
  context: z.string().nullable(),
  priority: todoPrioritySchema,
  dueDate: z.string().nullable(),
})
const todoSchema = parsedTodoSchema.extend({
  id: z.string(),
  input: z.string(),
  completed: z.boolean(),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
const versionSchema = z.object({
  version: z.string(),
  tag: z.string().nullable(),
  commit: z.string(),
  nativeVersion: z.string(),
})
const todoInputSchema = z.object({
  input: z.string().min(1).max(2_000).describe('Quoted TODO text to parse'),
})
const todoIdSchema = z.object({ id: z.string().uuid().describe('Todo ID') })
const deleteOutputSchema = z.object({ deleted: z.literal(true), id: z.string().uuid() })
type DeleteOutput = z.infer<typeof deleteOutputSchema>
const apiEnvSchema = z.object({
  TODO_API_URL: z.string().url().default('http://localhost:3000').describe('Todo API base URL'),
})
const serveEnvSchema = z.object({
  HOST: z.string().default('127.0.0.1').describe('HTTP listen host'),
  PORT: z.coerce.number().int().min(0).max(65_535).default(0).describe('HTTP listen port'),
})

function decodeHttpTodoInput(input: string, request: Request | undefined): string {
  if (request === undefined) return input

  const pathname = new URL(request.url).pathname
  if (pathname === '/mcp') return input

  // Incur 0.4.17 leaves HTTP path arguments encoded. Comparing against the raw segment avoids double-decoding after an upstream fix.
  const encodedInput = pathname.slice(pathname.lastIndexOf('/') + 1)
  return encodedInput === input ? decodeURIComponent(encodedInput) : input
}

export interface TodoCliDependencies {
  readonly createApi: (baseUrl: string) => TodoApi
  readonly createParser: () => TodoParser
  readonly startHttpServer: (options: {
    readonly fetch: (request: Request) => Promise<Response>
    readonly hostname: string
    readonly port: number
  }) => { readonly url: URL }
}

export function createTodoCli(dependencies: TodoCliDependencies) {
  const cli = Cli.create('todoctl', {
    version: VERSION,
    description: 'Manage todos through the todo HTTP API.',
    mcp: {
      instructions: 'Parse and manage todos through the configured todo HTTP API.',
    },
    sync: {
      suggestions: ['list my open todos', 'add a todo', 'complete a todo'],
    },
  })

  cli.command('api-version', {
    description: 'Show the API and native parser build identity.',
    env: apiEnvSchema,
    output: versionSchema,
    async run({ env }) {
      return dependencies.createApi(env.TODO_API_URL).version()
    },
  })

  cli.command('list', {
    description: 'List todos.',
    env: apiEnvSchema,
    options: z.object({
      status: z.enum(['all', 'open', 'completed']).default('open').describe('Status filter'),
      limit: z.number().int().min(1).max(100).default(50).describe('Maximum todos to return'),
    }),
    output: z.object({ items: z.array(todoSchema) }),
    async run({ env, options }) {
      const items = await dependencies
        .createApi(env.TODO_API_URL)
        .list(options.status, options.limit)
      return { items: [...items] }
    },
  })

  cli.command('add', {
    description: 'Create a todo, or parse it locally without writing.',
    args: todoInputSchema,
    env: apiEnvSchema,
    options: z.object({
      dryRun: z.boolean().default(false).describe('Parse without creating the todo'),
    }),
    output: z.union([todoSchema, parsedTodoSchema]),
    examples: [
      { args: { input: 'Buy oat milk @home #errands !high' }, description: 'Create a todo' },
      {
        args: { input: 'Read architecture docs @office #onboarding' },
        options: { dryRun: true },
        description: 'Preview parsed TODO fields',
      },
    ],
    async run({ args, env, options, request }) {
      const input = decodeHttpTodoInput(args.input, request)
      if (options.dryRun) return dependencies.createParser().parse(input)
      return dependencies.createApi(env.TODO_API_URL).create(input)
    },
  })

  cli.command('parse', {
    description: 'Parse TODO text locally with the Rust parser.',
    args: todoInputSchema,
    output: parsedTodoSchema,
    examples: [
      {
        args: { input: 'Buy oat milk @home #errands !high due:2026-08-01' },
        description: 'Parse TODO metadata',
      },
    ],
    run({ args, request }) {
      return dependencies.createParser().parse(decodeHttpTodoInput(args.input, request))
    },
  })

  cli.command('complete', {
    description: 'Mark a todo completed.',
    args: todoIdSchema,
    env: apiEnvSchema,
    output: todoSchema,
    async run({ args, env }) {
      return dependencies.createApi(env.TODO_API_URL).update(args.id, { completed: true })
    },
  })

  cli.command('reopen', {
    description: 'Mark a todo open.',
    args: todoIdSchema,
    env: apiEnvSchema,
    output: todoSchema,
    async run({ args, env }) {
      return dependencies.createApi(env.TODO_API_URL).update(args.id, { completed: false })
    },
  })

  cli.command('delete', {
    description: 'Delete a todo.',
    destructive: true,
    args: todoIdSchema,
    env: apiEnvSchema,
    output: deleteOutputSchema,
    async run({ args, env }): Promise<DeleteOutput> {
      await dependencies.createApi(env.TODO_API_URL).delete(args.id)
      const deleted = true
      return { deleted, id: args.id }
    },
  })

  cli.command('serve', {
    description: 'Expose todoctl commands through Incur HTTP.',
    env: serveEnvSchema,
    mcp: false,
    options: z.object({
      host: z.string().optional().describe('Override HOST'),
      port: z.number().int().min(0).max(65_535).optional().describe('Override PORT'),
    }),
    output: z.object({ url: z.string().url() }),
    run({ env, error, options, request }) {
      if (request !== undefined) {
        return error({
          code: 'LOCAL_ONLY',
          message: 'The serve command can only be started from the local CLI.',
        })
      }

      const server = dependencies.startHttpServer({
        hostname: options.host ?? env.HOST,
        port: options.port ?? env.PORT,
        fetch: (incomingRequest) => cli.fetch(incomingRequest),
      })
      return { url: server.url.toString() }
    },
  })

  return cli
}

const cli = createTodoCli({
  createApi: (baseUrl) => new TodoApiClient({ baseUrl }),
  createParser: createNativeTodoParser,
  startHttpServer: (options) => Bun.serve(options),
})

export default cli
