import { db, transaction } from '../../db/connection.ts'
import { HttpError } from '../../middleware/errors.ts'
import { findUser, INTERESTS } from '../auth/auth.service.ts'
import { notify } from '../notifications/notifications.service.ts'
import { hasBlocked, isBlocked } from '../safety/safety.service.ts'
import type { ProfileInput } from './people.schema.ts'

// For notification texts like "Ali wants to connect".
export function nameOf(userId: string) {
  return (db.prepare('SELECT name FROM users WHERE id = ?').get(userId) as any)?.name ?? 'Someone'
}

// How `viewer` is connected to `other`, from the viewer's side.
export function connectionStatus(viewerId: string, otherId: string) {
  const row: any = db
    .prepare('SELECT from_id, status FROM connections WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)')
    .get(viewerId, otherId, otherId, viewerId)
  if (!row) return null
  if (row.status === 'accepted') return 'accepted'
  return row.from_id === viewerId ? 'pending' : 'incoming'
}

// What anyone logged in can see on a profile. Email stays private.
export function getProfile(id: string, viewerId: string) {
  const user: any = db
    .prepare(`SELECT u.id, u.name, u.city, u.tagline, u.bio, ${INTERESTS} FROM users u WHERE u.id = ?`)
    .get(id)
  // Someone who blocked you looks like they don't exist.
  if (!user || hasBlocked(id, viewerId)) throw new HttpError(404, 'Profile not found')
  const groups = db
    .prepare(
      `SELECT g.id, g.name FROM group_members m JOIN groups g ON g.id = m.group_id
       WHERE m.user_id = ? AND m.status = 'joined' ORDER BY m.rowid`,
    )
    .all(id)
  return {
    ...user,
    interests: JSON.parse(user.interests),
    groups,
    connection: connectionStatus(viewerId, id),
    blocked: hasBlocked(viewerId, id), // you blocked them: the page offers Unblock
  }
}

// Returns the full logged-in user (with email), same shape as /api/auth/me.
export function updateProfile(id: string, input: ProfileInput) {
  transaction(() => {
    db.prepare('UPDATE users SET name = ?, city = ?, tagline = ?, bio = ? WHERE id = ?').run(
      input.name,
      input.city,
      input.tagline,
      input.bio,
      id,
    )
    // Replace the whole list: simplest way to keep the picked order.
    db.prepare('DELETE FROM user_interests WHERE user_id = ?').run(id)
    const add = db.prepare('INSERT OR IGNORE INTO user_interests (user_id, interest, position) VALUES (?, ?, ?)')
    input.interests.forEach((interest, position) => add.run(id, interest, position))
  })
  return findUser(id)
}

export function requestConnection(fromId: string, toId: string) {
  if (fromId === toId) throw new HttpError(400, 'You can’t connect with yourself')
  if (!db.prepare('SELECT 1 FROM users WHERE id = ?').get(toId)) throw new HttpError(404, 'Profile not found')
  if (isBlocked(fromId, toId)) throw new HttpError(403, 'You can’t connect with this person')
  const status = connectionStatus(fromId, toId)
  if (status === 'incoming') return answerConnection(fromId, toId, 'accept') // they already asked you: that's a yes
  if (status) return status
  db.prepare('INSERT INTO connections (from_id, to_id, created_at) VALUES (?, ?, ?)').run(fromId, toId, Date.now())
  notify(toId, 'update', `${nameOf(fromId)} wants to connect`, '/messages?view=Requests')
  return 'pending'
}

export function answerConnection(userId: string, fromId: string, decision: 'accept' | 'decline') {
  const where = "from_id = ? AND to_id = ? AND status = 'pending'"
  const sql =
    decision === 'accept'
      ? `UPDATE connections SET status = 'accepted' WHERE ${where}`
      : `DELETE FROM connections WHERE ${where}`
  if (!db.prepare(sql).run(fromId, userId).changes) throw new HttpError(404, 'Request not found')
  if (decision === 'accept') notify(fromId, 'update', `${nameOf(userId)} accepted your connection`, `/users/${userId}`)
  return decision === 'accept' ? 'accepted' : null
}

// Everything the Messages screen needs about people.
export function listConnections(userId: string) {
  const accepted = db
    .prepare(
      `SELECT u.id, u.name, u.city FROM connections c
       JOIN users u ON u.id = CASE WHEN c.from_id = ? THEN c.to_id ELSE c.from_id END
       WHERE (c.from_id = ? OR c.to_id = ?) AND c.status = 'accepted' ORDER BY u.name`,
    )
    .all(userId, userId, userId)
  const incoming = db
    .prepare(
      `SELECT u.id, u.name, u.city FROM connections c JOIN users u ON u.id = c.from_id
       WHERE c.to_id = ? AND c.status = 'pending' ORDER BY c.created_at`,
    )
    .all(userId)
  const outgoing = db
    .prepare(
      `SELECT u.id, u.name, u.city FROM connections c JOIN users u ON u.id = c.to_id
       WHERE c.from_id = ? AND c.status = 'pending' ORDER BY c.created_at`,
    )
    .all(userId)
  return { accepted, incoming, outgoing }
}
