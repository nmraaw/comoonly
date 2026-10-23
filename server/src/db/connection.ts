import { DatabaseSync } from 'node:sqlite'
import { mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { config } from '../config.ts'

// The whole database is one file (config.dbPath): server/data/comoonly.db locally, a persistent disk in production.
if (config.dbPath !== ':memory:') mkdirSync(dirname(config.dbPath), { recursive: true })

export const db = new DatabaseSync(config.dbPath)
db.exec('PRAGMA foreign_keys = ON') // SQLite ignores foreign keys unless you ask
db.exec('PRAGMA journal_mode = WAL') // readers don't wait for writers

// node:sqlite has no transaction helper. This makes several writes all-or-nothing.
// Called inside another transaction, it just joins that one (SQLite can't nest BEGIN).
export function transaction<T>(work: () => T): T {
  if (db.isTransaction) return work()
  db.exec('BEGIN')
  try {
    const result = work()
    db.exec('COMMIT')
    return result
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

// Migrations: each numbered file in ./migrations runs once, in order. SQLite's built-in `user_version`
// remembers the last one applied, so a deployed database gets exactly the changes it hasn't seen yet.
// To change the database, add a new file (002_...sql); never edit one that has already shipped.
const folder = new URL('./migrations/', import.meta.url)
const applied = (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version
const migrations = readdirSync(folder)
  .filter((f) => /^\d+_.+\.sql$/.test(f))
  .sort()
for (const file of migrations) {
  const version = parseInt(file, 10)
  if (version <= applied) continue
  transaction(() => {
    db.exec(readFileSync(new URL(file, folder), 'utf8'))
    db.exec(`PRAGMA user_version = ${version}`)
  })
}
