import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import './helpers.ts' // fresh in-memory database with sample data
import { db, migrate, transaction } from '../src/db/connection.ts'
import { config } from '../src/config.ts'

// Every test here also runs through Turso's library (`npm run test:libsql`), so the app's database code is
// checked against both. Run with Turso settings (see docs/DEPLOY_RENDER_TURSO.md) to check a real Turso database.
const count = (sql: string, ...params: string[]) => (db.prepare(sql).get(...params) as { n: number }).n
const version = () => (db.prepare('SELECT version FROM _schema_version').get() as { version: number }).version
const latest = Math.max(...readdirSync(new URL('../src/db/migrations/', import.meta.url)).map((f) => parseInt(f, 10)))

// The database guards its own rules, so even a bug in the server code can't store nonsense.
test('the database itself rejects invalid data', () => {
  const rejects = (sql: string, ...params: (string | number)[]) => assert.throws(() => db.prepare(sql).run(...params))

  // One connection per pair, whichever way round it was asked; nobody connects with themselves.
  db.prepare("INSERT INTO connections (from_id, to_id, created_at) VALUES ('hira', 'zain', 0)").run()
  rejects("INSERT INTO connections (from_id, to_id, created_at) VALUES ('zain', 'hira', 0)")
  rejects("INSERT INTO connections (from_id, to_id, created_at) VALUES ('hira', 'hira', 0)")

  rejects("INSERT INTO group_members (group_id, user_id, status) VALUES ('film-club', 'zain', 'maybe')") // unknown status
  rejects("INSERT INTO group_members (group_id, user_id) VALUES ('no-such-group', 'zain')") // foreign key
  rejects(
    "INSERT INTO messages (id, group_id, to_id, author_id, text, created_at) VALUES ('m', 'film-club', 'zain', 'sara', 'hi', 0)",
  ) // both targets
  rejects("INSERT INTO messages (id, group_id, author_id, text, created_at) VALUES ('m', 'film-club', 'sara', '', 0)") // empty
  rejects("INSERT INTO blocks (blocker_id, blocked_id, created_at) VALUES ('sara', 'sara', 0)")
  rejects("INSERT INTO users (id, name, email, password_hash, created_at) VALUES ('x', 'X', 'Not@Lower.case', 'h', 0)")
  rejects("UPDATE groups SET mode = 'Underwater' WHERE id = 'film-club'")
  rejects("UPDATE users SET verified = 2 WHERE id = 'sara'")
  rejects("UPDATE users SET instagram = 'javascript:x' WHERE id = 'sara'") // GLOB check
})

test('migrations: a fresh database gets every one, once; an old database is picked up from its version', () => {
  assert.equal(version(), latest) // all applied
  migrate() // running again changes nothing
  assert.equal(version(), latest)
  assert.equal(count('SELECT COUNT(*) AS n FROM _schema_version'), 1)

  // A database from before `_schema_version` (only SQLite's built-in number) starts the table from that number,
  // without re-running anything (re-running 001 would fail: its tables exist).
  db.exec('DELETE FROM _schema_version')
  db.exec(`PRAGMA user_version = ${latest}`)
  migrate()
  assert.equal(version(), latest)
})

test('deleting cascades: a person, a group and an event take what only made sense with them', () => {
  const add = (sql: string) => db.prepare(sql).run()
  // An event with a poster, someone going, its everyone-going group and a crew with a message and a member.
  add(`INSERT INTO events (id, title, starts_at, register_url, source_url, status, created_at, suggested_by)
       VALUES ('ev', 'Jam', '2030-01-01', 'https://x.test', 'https://x.test', 'published', 0, 'noor')`)
  add("INSERT INTO event_posters (event_id, mime, bytes) VALUES ('ev', 'image/png', x'00')")
  add("INSERT INTO event_going (event_id, user_id, intent, created_at) VALUES ('ev', 'hira', 'company', 0)")
  add(`INSERT INTO groups (id, owner_id, name, title, description, category, mode, location, capacity, color, created_at, event_id)
       VALUES ('crew', 'hira', 'Crew', 'Crew', 'Gate 5', 'Event', 'In person', 'Lahore', 3, 'mint', 0, 'ev')`)
  add("INSERT INTO group_members (group_id, user_id) VALUES ('crew', 'hira')")
  add("INSERT INTO messages (id, group_id, author_id, text, created_at) VALUES ('cm', 'crew', 'hira', 'hi', 0)")
  add("INSERT INTO message_audio (message_id, mime, bytes) VALUES ('cm', 'audio/webm', x'00')")
  add("INSERT INTO user_photos (user_id, mime, bytes) VALUES ('zain', 'image/png', x'00')")
  add("INSERT INTO messages (id, to_id, author_id, text, created_at) VALUES ('dm', 'hira', 'zain', 'yo', 0)")

  // A person: their photo, interests, private messages and memberships go; events they suggested stay.
  add("DELETE FROM users WHERE id = 'zain'")
  assert.equal(count("SELECT COUNT(*) AS n FROM user_photos WHERE user_id = 'zain'"), 0)
  assert.equal(count("SELECT COUNT(*) AS n FROM user_interests WHERE user_id = 'zain'"), 0)
  assert.equal(count("SELECT COUNT(*) AS n FROM messages WHERE id = 'dm'"), 0)
  assert.equal(count("SELECT COUNT(*) AS n FROM connections WHERE 'zain' IN (from_id, to_id)"), 0)
  add("DELETE FROM users WHERE id = 'noor'")
  assert.equal(count("SELECT COUNT(*) AS n FROM events WHERE id = 'ev' AND suggested_by IS NULL"), 1)

  // An event: its poster, who's going and its crews (with their messages and voice notes) go.
  add("DELETE FROM events WHERE id = 'ev'")
  for (const table of ['event_posters', 'event_going']) assert.equal(count(`SELECT COUNT(*) AS n FROM ${table}`), 0)
  assert.equal(count("SELECT COUNT(*) AS n FROM groups WHERE id = 'crew'"), 0)
  assert.equal(count("SELECT COUNT(*) AS n FROM messages WHERE id = 'cm'"), 0)
  assert.equal(count('SELECT COUNT(*) AS n FROM message_audio'), 0)
})

test('transactions: all-or-nothing, and a nested one joins the outer one', () => {
  const people = () => count('SELECT COUNT(*) AS n FROM users')
  const before = people()
  const addUser = (id: string) =>
    db
      .prepare("INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, 'T', ?, 'h', 0)")
      .run(id, `${id}@t.test`)

  assert.throws(() =>
    transaction(() => {
      addUser('t1')
      addUser('t1') // same id: fails, so t1 must not stay either
    }),
  )
  assert.equal(people(), before)

  assert.throws(() =>
    transaction(() => {
      addUser('t2')
      transaction(() => {
        addUser('t3')
        throw new Error('inner step failed')
      })
    }),
  )
  assert.equal(people(), before) // the inner failure undid the outer writes too
  assert.equal(db.isTransaction, false)

  transaction(() => addUser('t4'))
  assert.equal(people(), before + 1)
})

test('database library differences are smoothed over', () => {
  // Binary data comes back byte for byte (photos, posters, voice notes).
  db.prepare("INSERT INTO user_photos (user_id, mime, bytes) VALUES ('sara', 'image/png', ?)").run(
    Buffer.from([1, 2, 255]),
  )
  const photo = db.prepare("SELECT bytes FROM user_photos WHERE user_id = 'sara'").get() as { bytes: Uint8Array }
  assert.deepEqual([...Buffer.from(photo.bytes)], [1, 2, 255])
  // Rows contain only the columns asked for (Turso's library adds `_metadata`, removed by connection.ts).
  assert.deepEqual(Object.keys(db.prepare("SELECT id, name FROM users WHERE id = 'sara'").get()!), ['id', 'name'])
  assert.equal(db.prepare("UPDATE users SET bio = bio WHERE id = 'sara'").run().changes, 1)
  // Turso's library crashes the whole server on true/false; connection.ts turns them into 1/0.
  if (config.dbDriver === 'libsql') {
    assert.equal((db.prepare('SELECT ? AS x').get(true) as { x: number }).x, 1)
  }
})
