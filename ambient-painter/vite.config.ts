import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  // For GitHub Pages the app is served from /<repo>/
  // In dev we keep '/' so you can open http://localhost:5173 normally.
  const repo = process.env.GITHUB_REPOSITORY?.split('/')[1]
  const base = command === 'build' && repo ? `/${repo}/` : '/'

  return {
    base,
    plugins: [react()],
  }
})
