import { randomUUID } from 'node:crypto'
import { db } from '../../db/connection.ts'
import { HttpError } from '../../middleware/errors.ts'
import { requireMember } from '../groups/groups.service.ts'
import { notify, markRead } from '../notifications/notifications.service.ts'
import { connectionStatus, nameOf } from '../people/people.service.ts'

const LIMIT = 200 // newest 200 messages per conversation is plenty for small groups

const SELECT = `SELECT m.id, m.author_id AS authorId, u.name AS author, m.text, m.created_at AS createdAt
  FROM messages m JOIN users u ON u.id = m.author_id`

// Query returns newest first (so LIMIT keeps the latest); the screen wants oldest first.
const oldestFirst = (rows: unknown[]) => rows.reverse()

function requireConnected(userId: string, otherId: string) {
  if (connectionStatus(userId, otherId) !== 'accepted') {
    throw new HttpError(403, 'Connect before sending a private message')
  }
}

// Reading a chat counts as seeing it: its notification is marked read.
export function groupMessages(groupId: string, userId: string) {
  requireMember(groupId, userId)
  markRead(userId, `/groups/${groupId}?tab=Chat`)
  const rows = db
    .prepare(
      `${SELECT} WHERE m.group_id = ? AND m.author_id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = ?)
       ORDER BY m.created_at DESC, m.rowid DESC LIMIT ${LIMIT}`,
    )
    .all(groupId, userId)
  return oldestFirst(rows)
}

export function directMessages(userId: string, otherId: string) {
  requireConnected(userId, otherId)
  markRead(userId, `/messages?chat=${otherId}`)
  const rows = db
    .prepare(
      `${SELECT} WHERE ((m.author_id = ? AND m.to_id = ?) OR (m.author_id = ? AND m.to_id = ?))
       ORDER BY m.created_at DESC, m.rowid DESC LIMIT ${LIMIT}`,
    )
    .all(userId, otherId, otherId, userId)
  return oldestFirst(rows)
}

export function sendToGroup(groupId: string, userId: string, text: string) {
  const group = requireMember(groupId, userId)
  const message = insert({ groupId, toId: null, userId, text })
  // Everyone else in the group, except people who blocked the sender.
  const others = db
    .prepare(
      `SELECT user_id FROM group_members WHERE group_id = ? AND status = 'joined' AND user_id != ?
       AND user_id NOT IN (SELECT blocker_id FROM blocks WHERE blocked_id = ?)`,
    )
    .all(groupId, userId, userId)
    .map((r: any) => r.user_id)
  // Group chats live in their group, not in Messages (that's for private chats), so this is a bell notice.
  notify(others, 'update', `${nameOf(userId)} in ${group.name}: ${text}`, `/groups/${groupId}?tab=Chat`, true)
  return message
}

export function sendDirect(userId: string, otherId: string, text: string) {
  requireConnected(userId, otherId)
  const message = insert({ groupId: null, toId: otherId, userId, text })
  notify(otherId, 'message', `${nameOf(userId)}: ${text}`, `/messages?chat=${userId}`)
  return message
}

function insert(m: { groupId: string | null; toId: string | null; userId: string; text: string }) {
  const id = randomUUID()
  db.prepare('INSERT INTO messages (id, group_id, to_id, author_id, text, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    id,
    m.groupId,
    m.toId,
    m.userId,
    m.text,
    Date.now(),
  )
  return db.prepare(`${SELECT} WHERE m.id = ?`).get(id)
}

// The Messages screen: private chats with your accepted connections, each with its latest message.
export function conversations(userId: string) {
  const people = db
    .prepare(
      `SELECT u.id, u.name,
         (SELECT text FROM messages WHERE (author_id = u.id AND to_id = ?) OR (author_id = ? AND to_id = u.id)
          ORDER BY created_at DESC LIMIT 1) AS last
       FROM connections c JOIN users u ON u.id = CASE WHEN c.from_id = ? THEN c.to_id ELSE c.from_id END
       WHERE (c.from_id = ? OR c.to_id = ?) AND c.status = 'accepted' ORDER BY u.name`,
    )
    .all(userId, userId, userId, userId, userId)
  return { people }
}
