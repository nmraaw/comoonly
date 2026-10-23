import { randomUUID } from 'node:crypto'
import { db } from '../../db/connection.ts'

// 'message' = a chat or private message (lights up the Messages tab); 'update' = everything else.
type Kind = 'message' | 'update'

// Called by other features: notify(hostId, 'update', 'Ali asked to join Film club', '/groups/x?tab=Members').
export function notify(userIds: string | string[], kind: Kind, text: string, link: string) {
  const now = Date.now()
  const short = text.length > 140 ? `${text.slice(0, 139)}…` : text
  for (const userId of [userIds].flat()) {
    // A busy chat updates its one unread notice instead of piling up one per message.
    const merged =
      kind === 'message' &&
      db
        .prepare('UPDATE notifications SET text = ?, created_at = ? WHERE user_id = ? AND link = ? AND read = 0')
        .run(short, now, userId, link).changes
    if (!merged) {
      db.prepare('INSERT INTO notifications (id, user_id, kind, text, link, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
        randomUUID(),
        userId,
        kind,
        short,
        link,
        now,
      )
    }
  }
}

export function listNotifications(userId: string) {
  // Old read notices are cleared out so the table doesn't grow forever.
  db.prepare('DELETE FROM notifications WHERE user_id = ? AND read = 1 AND created_at < ?').run(userId, Date.now() - 60 * 86_400_000)
  return db
    .prepare('SELECT id, kind, text, link, read, created_at AS createdAt FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50')
    .all(userId)
    .map((n: any) => ({ ...n, read: Boolean(n.read) }))
}

// For the badges: total unread, and how many of those are messages.
export function unreadCounts(userId: string) {
  const row: any = db
    .prepare("SELECT COUNT(*) AS total, COALESCE(SUM(kind = 'message'), 0) AS messages FROM notifications WHERE user_id = ? AND read = 0")
    .get(userId)
  return { total: row.total, messages: row.messages }
}

// Opening a chat marks its notices read (pass its link); opening the notifications page marks all.
export function markRead(userId: string, link?: string) {
  if (link) db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ? AND link = ?').run(userId, link)
  else db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(userId)
}
