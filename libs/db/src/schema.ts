import { boolean, date, index, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const todoPriority = pgEnum('todo_priority', ['low', 'normal', 'high', 'urgent'])

export const todos = pgTable(
  'todos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    input: text('input').notNull(),
    title: text('title').notNull(),
    tags: text('tags').array().notNull().default([]),
    context: text('context'),
    priority: todoPriority('priority').notNull().default('normal'),
    dueDate: date('due_date', { mode: 'string' }),
    completed: boolean('completed').notNull().default(false),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('todos_completed_created_at_idx').on(table.completed, table.createdAt),
    index('todos_due_date_idx').on(table.dueDate),
  ],
)

export type TodoRow = typeof todos.$inferSelect
export type NewTodoRow = typeof todos.$inferInsert
