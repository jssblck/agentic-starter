import { TodoApiClient } from '@starter/api'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { createWebQueryClient, createWebRouter } from './router.tsx'
import './app.css'

const rootElement = document.getElementById('root')
if (rootElement === null) {
  throw new Error('Web app root element was not found')
}

const queryClient = createWebQueryClient()
const router = createWebRouter({
  api: new TodoApiClient({ baseUrl: globalThis.location.origin }),
  queryClient,
})

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
