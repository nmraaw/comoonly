import { randomUUID } from 'node:crypto'
import { db, transaction } from '../../db/connection.ts'
import { HttpError } from '../../middleware/errors.ts'
import { requireMember } from '../groups/groups.service.ts'
import { notify, markRead } from '../notifications/notifications.service.ts'
import { answerConnection, connectionStatus, nameOf } from '../people/people.service.ts'
import { isBlocked } from '../safety/safety.service.ts'

const LIMIT = 200 // newest 200 messages per conversation is plenty for small groups

const SELECT = `SELECT m.id, m.author_id AS authorId, u.name AS author, m.text, m.created_at AS createdAt,
    EXISTS (SELECT 1 FROM message_audio a WHERE a.message_id = m.id) AS voice,
    (SELECT options FROM polls p WHERE p.message_id = m.id) AS poll,
    (SELECT json_group_array(json_object('userId', v.user_id, 'choice', v.choice))
       FROM poll_votes v WHERE v.message_id = m.id) AS votes
  FROM messages m JOIN users u ON u.id = m.author_id`

// Polls come out of SQL as JSON text; the app gets real lists (and plain messages get neither).
function withPoll(m: any) {
  if (!m) return m
  const { poll, votes, ...rest } = m
  return poll ? { ...rest, poll: JSON.parse(poll), votes: JSON.parse(votes) } : rest
}

// Query returns newest first (so LIMIT keeps the latest); the screen wants oldest first.
const oldestFirst = (rows: unknown[]) => rows.reverse().map(withPoll)

// Anyone can message anyone they haven't blocked (and who hasn't blocked them).
function requireNotBlocked(userId: string, otherId: string) {
  if (userId === otherId) throw new HttpError(400, 'That’s you')
  if (!db.prepare('SELECT 1 FROM users WHERE id = ?').get(otherId)) throw new HttpError(404, 'Profile not found')
  if (isBlocked(userId, otherId)) throw new HttpError(403, 'You can’t message this person')
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
  requireNotBlocked(userId, otherId)
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

// Messaging someone you're not connected to sends a message request: one message, which lands in their
// Requests. Accepting it, or replying, makes it a normal chat. One message only, so nobody can spam.
export function sendDirect(userId: string, otherId: string, text: string) {
  requireNotBlocked(userId, otherId)
  const status = connectionStatus(userId, otherId)
  if (status === 'incoming') answerConnection(userId, otherId, 'accept') // replying to a request accepts it
  if (
    status === 'pending' &&
    db.prepare('SELECT 1 FROM messages WHERE author_id = ? AND to_id = ?').get(userId, otherId)
  )
    throw new HttpError(403, `Wait for ${nameOf(otherId).split(' ')[0]} to accept your message request`)
  if (!status)
    db.prepare('INSERT INTO connections (from_id, to_id, created_at) VALUES (?, ?, ?)').run(userId, otherId, Date.now())
  const message = insert({ groupId: null, toId: otherId, userId, text })
  const request = status === null || status === 'pending'
  notify(
    otherId,
    'message',
    request ? `${nameOf(userId)} sent you a message request: ${text}` : `${nameOf(userId)}: ${text}`,
    `/messages?chat=${userId}`,
  )
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
  return withPoll(db.prepare(`${SELECT} WHERE m.id = ?`).get(id))
}

export function createPoll(groupId: string, userId: string, question: string, options: string[]) {
  return transaction(() => {
    const message: any = sendToGroup(groupId, userId, `📊 ${question}`)
    db.prepare('INSERT INTO polls (message_id, options) VALUES (?, ?)').run(message.id, JSON.stringify(options))
    return withPoll(db.prepare(`${SELECT} WHERE m.id = ?`).get(message.id))
  })
}

// Voting again changes your vote. Only members of the poll's group can vote.
export function vote(messageId: string, userId: string, choice: number) {
  const poll: any = db
    .prepare('SELECT p.options, m.group_id FROM polls p JOIN messages m ON m.id = p.message_id WHERE p.message_id = ?')
    .get(messageId)
  if (!poll) throw new HttpError(404, 'Poll not found')
  requireMember(poll.group_id, userId)
  if (choice >= JSON.parse(poll.options).length) throw new HttpError(400, 'That choice isn’t in the poll')
  db.prepare(
    'INSERT INTO poll_votes (message_id, user_id, choice) VALUES (?, ?, ?) ON CONFLICT (message_id, user_id) DO UPDATE SET choice = excluded.choice',
  ).run(messageId, userId, choice)
}

// The Messages screen: private chats (connections, and requests you sent) and your group chats,
// each with its latest message. Requests sent to you are listed by /connections (the Requests tab).
export function conversations(userId: string) {
  const last = `(SELECT text FROM messages WHERE (author_id = u.id AND to_id = ?) OR (author_id = ? AND to_id = u.id)
    ORDER BY created_at DESC LIMIT 1)`
  const people = db
    .prepare(
      `SELECT u.id, u.name, c.status, ${last} AS last
       FROM connections c JOIN users u ON u.id = CASE WHEN c.from_id = ? THEN c.to_id ELSE c.from_id END
       WHERE (c.status = 'accepted' AND (c.from_id = ? OR c.to_id = ?))
          OR (c.status = 'pending' AND c.from_id = ? AND ${last} IS NOT NULL)
       ORDER BY u.name`,
    )
    .all(userId, userId, userId, userId, userId, userId, userId, userId)
  const groups = db
    .prepare(
      `SELECT g.id, g.name, g.color,
         (SELECT text FROM messages WHERE group_id = g.id ORDER BY created_at DESC LIMIT 1) AS last
       FROM group_members gm JOIN groups g ON g.id = gm.group_id
       WHERE gm.user_id = ? AND gm.status = 'joined' ORDER BY g.name`,
    )
    .all(userId)
  return { people, groups }
}

export const VOICE_TEXT = '🎤 Voice message'

// Who may hear a voice message: the group's members, or the two people in a private chat.
export function requireCanHear(messageId: string, userId: string) {
  const m: any = db.prepare('SELECT group_id, author_id, to_id FROM messages WHERE id = ?').get(messageId)
  if (!m) throw new HttpError(404, 'Message not found')
  if (m.group_id) requireMember(m.group_id, userId)
  else if (userId !== m.author_id && userId !== m.to_id) throw new HttpError(404, 'Message not found')
}
