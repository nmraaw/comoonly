import { DatabaseSync } from 'node:sqlite'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { config } from '../config.ts'

if (config.dbPath !== ':memory:') mkdirSync(dirname(config.dbPath), { recursive: true })

export const db = new DatabaseSync(config.dbPath)
db.exec('PRAGMA foreign_keys = ON') // SQLite ignores foreign keys unless you ask
db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'))

// Columns added after a table first existed. schema.sql only creates missing tables, so existing
// databases (yours, or a deployed one) get new columns here. Append to this list; never edit old lines.
const NEW_COLUMNS = [
  "ALTER TABLE activities ADD COLUMN plan TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE activities ADD COLUMN notes TEXT NOT NULL DEFAULT ''",
]
for (const sql of NEW_COLUMNS) {
  try {
    db.exec(sql)
  } catch (err) {
    if (!String(err).includes('duplicate column')) throw err // already there is fine; anything else is a real problem
  }
}

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
