import { DatabaseSync } from 'node:sqlite'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { config } from '../config.ts'

if (config.dbPath !== ':memory:') mkdirSync(dirname(config.dbPath), { recursive: true })

export const db = new DatabaseSync(config.dbPath)
db.exec('PRAGMA foreign_keys = ON') // SQLite ignores foreign keys unless you ask
db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'))

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
