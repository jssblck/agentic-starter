import { createFileRoute } from '@tanstack/react-router'

import { TodosPage } from '../todos/todos-page.tsx'

export const Route = createFileRoute('/')({ component: TodosPage })
