import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // In development, the page and the API look like one site, so the session cookie just works.
  server: { proxy: { '/api': 'http://localhost:3001' } },
})
