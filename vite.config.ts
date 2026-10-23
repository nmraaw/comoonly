import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// Two separate pages, built separately: the public app (index.html) and the admin interface
// (admin/index.html, served at /admin/). The public app's code contains nothing from the admin one.
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        app: fileURLToPath(new URL('./index.html', import.meta.url)),
        admin: fileURLToPath(new URL('./admin/index.html', import.meta.url)),
      },
    },
  },
  // In development, the page and the API look like one site, so the session cookie just works.
  server: { proxy: { '/api': 'http://localhost:3001' } },
})
