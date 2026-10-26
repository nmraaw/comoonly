// Copies every row of a local Comoonly database file into an EMPTY Turso database (checklist step D).
//
//   node --env-file=<settings with TURSO_DATABASE_URL and TURSO_AUTH_TOKEN> server/scripts/copy-to-turso.ts <copy.db>
//
// Give it a copy made with the app stopped (see docs/DEPLOY_RENDER_TURSO.md), never the live file.
// The app's own connection creates the tables in Turso (the migrations) before rows are copied.
// It refuses to run if Turso already holds people, so it can't mix data or copy twice.
// Without Turso settings and with DB_DRIVER=libsql + DB_PATH=<file>, it copies into that local file
// instead: the dry run used to test it.
import { DatabaseSync } from 'node:sqlite'

const source = process.argv[2]
if (!source) throw new Error('Usage: copy-to-turso.ts <copy.db>')
const from = new DatabaseSync(source, { readOnly: true })
const { db: to } = await import('../src/db/connection.ts')

const count = (database: DatabaseSync, table: string) =>
  (database.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n
if (count(to, 'users') > 0) throw new Error('The target already has people in it: empty it first. Nothing was copied.')

// Parents before children, so every foreign key finds its row. events.group_id and groups.event_id point at
// each other, so events go in without their group first and get it back at the end.
const ORDER = [
  'users',
  'user_interests',
  'sessions',
  'email_codes',
  'user_photos',
  'connections',
  'blocks',
  'reports',
  'events',
  'event_posters',
  'seen_posts',
  'groups',
  'group_photos',
  'group_members',
  'saved_groups',
  'event_going',
  'messages',
  'message_audio',
  'notifications',
]
const tables = (from.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[])
  .map((t) => t.name)
  .filter((t) => !t.startsWith('sqlite_') && t !== '_schema_version')
const unknown = tables.filter((t) => !ORDER.includes(t))
if (unknown.length) throw new Error(`Not in the copy order, add them first: ${unknown.join(', ')}`)

// Big pictures over a slow line sometimes drop the connection: try each row again (OR REPLACE above makes a
// retry of a row that did arrive harmless).
function retry(work: () => unknown) {
  for (let attempt = 1; ; attempt++) {
    try {
      return work()
    } catch (err) {
      if (attempt >= 5 || !/Hrana\(Http|connection|timed out/i.test(String(err))) throw err
      console.log(`  connection dropped, trying again (${attempt}/4)`)
    }
  }
}

const columns = (database: DatabaseSync, table: string) =>
  (database.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name)

for (const table of ORDER.filter((t) => tables.includes(t))) {
  const shared = columns(from, table).filter((c) => columns(to, table).includes(c))
  const insert = to.prepare(
    `INSERT OR REPLACE INTO ${table} (${shared.join(', ')}) VALUES (${shared.map(() => '?').join(', ')})`,
  )
  const rows = from.prepare(`SELECT ${shared.join(', ')} FROM ${table}`).all() as Record<string, unknown>[]
  for (const row of rows) {
    const values = shared.map((c) => (table === 'events' && c === 'group_id' ? null : row[c]))
    retry(() => insert.run(...(values as any[])))
  }
  console.log(`${table}: ${rows.length}`)
}
const links = from.prepare('SELECT id, group_id FROM events WHERE group_id IS NOT NULL').all() as any[]
for (const e of links) retry(() => to.prepare('UPDATE events SET group_id = ? WHERE id = ?').run(e.group_id, e.id))

// Check: same number of rows everywhere, and pictures and voice notes byte for byte the same size.
const problems = tables.filter((t) => count(from, t) !== count(to, t))
for (const t of ['event_posters', 'user_photos', 'group_photos', 'message_audio'].filter((t) => tables.includes(t))) {
  const size = (database: DatabaseSync) =>
    (database.prepare(`SELECT COALESCE(SUM(length(bytes)), 0) AS n FROM ${t}`).get() as { n: number }).n
  if (size(from) !== size(to)) problems.push(`${t} (sizes differ)`)
}
const linked = (database: DatabaseSync) =>
  (database.prepare('SELECT COUNT(*) AS n FROM events WHERE group_id IS NOT NULL').get() as { n: number }).n
if (linked(from) !== linked(to)) problems.push('events.group_id')
if (problems.length) throw new Error(`Copied, but these don't match: ${problems.join(', ')}`)
console.log(`All ${tables.length} tables match, including pictures and voice notes.`)
