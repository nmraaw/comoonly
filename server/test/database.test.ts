import { test } from 'node:test'
import assert from 'node:assert/strict'
import './helpers.ts' // fresh in-memory database with sample data
import { db } from '../src/db/connection.ts'

// The database guards its own rules, so even a bug in the server code can't store nonsense.
test('the database itself rejects invalid data', () => {
  const rejects = (sql: string, ...params: (string | number)[]) => assert.throws(() => db.prepare(sql).run(...params))

  assert.equal((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version, 1) // migration 001 applied

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

  // Deleting a person removes what only made sense with them, but keeps events they suggested.
  db.prepare("UPDATE events SET suggested_by = 'zain'").run()
  db.prepare("DELETE FROM users WHERE id = 'zain'").run()
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM connections WHERE 'zain' IN (from_id, to_id)").get()!.n, 0)
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM user_interests WHERE user_id = 'zain'").get()!.n, 0)
})
