import { DatabaseSync } from 'node:sqlite'
import { mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { config } from '../config.ts'

// The whole database is one file (config.dbPath): server/data/comoonly.db locally. On Render it lives in
// Turso instead (config.turso), and the file is just a local copy.
if (config.dbPath !== ':memory:') mkdirSync(dirname(config.dbPath), { recursive: true })

export const usingTurso = Boolean(config.turso.url)
export const db: DatabaseSync = config.dbDriver === 'libsql' ? await openLibsql() : new DatabaseSync(config.dbPath)
db.exec('PRAGMA foreign_keys = ON') // SQLite ignores foreign keys unless you ask
if (!usingTurso) db.exec('PRAGMA journal_mode = WAL') // readers don't wait for writers (Turso manages this itself)

// Turso's library (better-sqlite3 style) looks like Node's built-in one to the rest of the app, with three
// differences smoothed over here (each one crashes or changes data otherwise; see database.test.ts):
// - values always go in as one list: a lone binary value (a photo) is otherwise misread and crashes the process
// - true/false would crash the process too: they become 1/0
// - rows carry an extra `_metadata` field: removed
async function openLibsql(): Promise<DatabaseSync> {
  const { default: Database } = await import('libsql')
  const raw = usingTurso
    ? new Database(config.dbPath, { syncUrl: config.turso.url, authToken: config.turso.token })
    : new Database(config.dbPath)
  if (usingTurso) raw.sync() // bring the local copy up to date with Turso before serving anything
  const clean = (row: any) => {
    if (row && typeof row === 'object') delete row._metadata
    return row
  }
  const bind = (args: unknown[]) => [args.map((a) => (typeof a === 'boolean' ? Number(a) : a))]
  return {
    prepare(sql: string) {
      const statement = raw.prepare(sql)
      return {
        get: (...args: unknown[]) => clean(statement.get(...bind(args))),
        all: (...args: unknown[]) => statement.all(...bind(args)).map(clean),
        run: (...args: unknown[]) => statement.run(...bind(args)),
      }
    },
    exec: (sql: string) => raw.exec(sql),
    get isTransaction() {
      return raw.inTransaction
    },
  } as unknown as DatabaseSync
}

// Node's SQLite has no transaction helper. This makes several writes all-or-nothing.
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

// Migrations: each numbered file in ./migrations runs once, in order. The `_schema_version` table remembers
// the last one applied, so a deployed database gets exactly the changes it hasn't seen yet. (It used to be
// SQLite's built-in `user_version`, which Turso doesn't allow changing; a database that only has that number
// starts the table from it.) To change the database, add a new file; never edit one that has already shipped.
export function migrate() {
  db.exec('CREATE TABLE IF NOT EXISTS _schema_version (version INTEGER NOT NULL)')
  let row = db.prepare('SELECT version FROM _schema_version').get() as { version: number } | undefined
  if (!row) {
    const legacy = (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version
    db.prepare('INSERT INTO _schema_version (version) VALUES (?)').run(legacy)
    row = { version: legacy }
  }
  const folder = new URL('./migrations/', import.meta.url)
  const migrations = readdirSync(folder)
    .filter((f) => /^\d+_.+\.sql$/.test(f))
    .sort()
  for (const file of migrations) {
    const version = parseInt(file, 10)
    if (version <= row.version) continue
    transaction(() => {
      db.exec(readFileSync(new URL(file, folder), 'utf8'))
      db.prepare('UPDATE _schema_version SET version = ?').run(version)
    })
  }
}
migrate()
