import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const DEFAULT_API_URL = 'http://localhost:3000'

function apiProxyTarget(value: string | undefined): string {
  const url = new URL(value ?? DEFAULT_API_URL)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('TODO_API_URL must use http or https')
  }
  return url.origin
}

export default defineConfig(() => {
  const target = apiProxyTarget(process.env['TODO_API_URL'])

  return {
    plugins: [
      tanstackRouter({ target: 'react' }),
      react(),
      babel({ presets: [reactCompilerPreset()] }),
      tailwindcss(),
    ],
    server: {
      proxy: {
        '/api': { changeOrigin: true, target },
      },
    },
  }
})
