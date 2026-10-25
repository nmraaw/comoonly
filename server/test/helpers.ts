import { after } from 'node:test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Each test file runs in its own process with a fresh in-memory database full of sample data.
// These must be set before the app (and its config/db) is imported.
// Against Turso (`npm run test:turso`) the local copy must be a file: a fresh temporary one.
process.env.DB_PATH = process.env.TURSO_DATABASE_URL
  ? join(mkdtempSync(join(tmpdir(), 'comoonly-turso-')), 'copy.db')
  : ':memory:'
process.env.ADMIN_EMAILS = 'sara@comoonly.test'
const { app } = await import('../src/app.ts')
const { seedIfEmpty } = await import('../src/db/seed.ts')

seedIfEmpty()
const server = app.listen(0)
after(() => server.close())
export const base = `http://localhost:${(server.address() as { port: number }).port}/api`

export const json = (body: unknown, cookie = '', method = 'POST') => ({
  method,
  headers: { 'content-type': 'application/json', cookie },
  body: JSON.stringify(body),
})

export const get = async (path: string, cookie = '') => (await fetch(base + path, { headers: { cookie } })).json()

export const status = async (path: string, init?: RequestInit) => (await fetch(base + path, init)).status

// Seed users log in with `<id>@comoonly.test` and the demo password.
export async function loginAs(id: string) {
  const res = await fetch(`${base}/auth/login`, json({ email: `${id}@comoonly.test`, password: 'comoonly-demo' }))
  return res.headers.get('set-cookie')!.split(';')[0]
}
