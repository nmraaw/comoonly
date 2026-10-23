import { randomUUID } from 'node:crypto'
import { db, transaction } from '../../db/connection.ts'
import { HttpError } from '../../middleware/errors.ts'
import type { ReportInput } from './safety.schema.ts'

// True if either person blocked the other. Used by connections, messages and join requests.
export function isBlocked(a: string, b: string) {
  return Boolean(
    db.prepare('SELECT 1 FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)').get(a, b, b, a),
  )
}

export function hasBlocked(blockerId: string, blockedId: string) {
  return Boolean(db.prepare('SELECT 1 FROM blocks WHERE blocker_id = ? AND blocked_id = ?').get(blockerId, blockedId))
}

// People this person blocked, so their group-chat messages can be hidden from them.
export function blockedIds(userId: string): string[] {
  return db.prepare('SELECT blocked_id FROM blocks WHERE blocker_id = ?').all(userId).map((r: any) => r.blocked_id)
}

function requireOtherPerson(userId: string, otherId: string) {
  if (userId === otherId) throw new HttpError(400, 'That’s you')
  if (!db.prepare('SELECT 1 FROM users WHERE id = ?').get(otherId)) throw new HttpError(404, 'Profile not found')
}

// Blocking also ends any connection, which closes private messages both ways.
export function block(blockerId: string, blockedId: string) {
  requireOtherPerson(blockerId, blockedId)
  transaction(() => {
    db.prepare('INSERT OR IGNORE INTO blocks (blocker_id, blocked_id, created_at) VALUES (?, ?, ?)').run(blockerId, blockedId, Date.now())
    db.prepare('DELETE FROM connections WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)').run(
      blockerId,
      blockedId,
      blockedId,
      blockerId,
    )
  })
}

export function unblock(blockerId: string, blockedId: string) {
  db.prepare('DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?').run(blockerId, blockedId)
}

export function report(reporterId: string, reportedId: string, input: ReportInput) {
  requireOtherPerson(reporterId, reportedId)
  db.prepare('INSERT INTO reports (id, reporter_id, reported_id, reason, details, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    randomUUID(),
    reporterId,
    reportedId,
    input.reason,
    input.details,
    Date.now(),
  )
}
