import { randomUUID } from 'node:crypto'
import { db, transaction } from '../../db/connection.ts'
import { HttpError } from '../../middleware/errors.ts'
import { createGroup } from '../groups/groups.service.ts'
import type { EventInput, EventPatch } from './events.schema.ts'

const SELECT = `SELECT e.id, e.title, e.starts_at AS date, e.city, e.mode, e.category, e.description,
    e.register_url AS registerUrl, e.source_url AS sourceUrl, e.status, e.group_id AS groupId,
    (SELECT COUNT(*) FROM group_members m WHERE m.group_id = e.group_id AND m.status = 'joined') AS goingCount
  FROM events e`

// Returns false for a duplicate, so nothing is saved twice. The same event is often listed on several
// pages (e.g. an online talk on both the Lahore and Karachi pages), so its own link counts too.
export function saveEvent(input: EventInput, status: 'draft' | 'published' = 'draft') {
  const result = db
    .prepare(
      `INSERT OR IGNORE INTO events (id, title, starts_at, city, mode, category, description, register_url, source_url, status, created_at)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       WHERE NOT EXISTS (SELECT 1 FROM events WHERE register_url = ? OR (title = ? AND starts_at = ?))`,
    )
    .run(randomUUID(), input.title, input.date, input.city, input.mode, input.category, input.description,
      input.registerUrl, input.sourceUrl, status, Date.now(), input.registerUrl, input.title, input.date)
  return result.changes > 0
}

// Public feed: published and not over yet (dates are ISO text, so text comparison works).
export function listPublished() {
  const today = new Date().toISOString().slice(0, 10)
  return db.prepare(`${SELECT} WHERE e.status = 'published' AND e.starts_at >= ? ORDER BY e.starts_at`).all(today)
}

export function listDrafts() {
  return db.prepare(`${SELECT} WHERE e.status = 'draft' ORDER BY e.starts_at`).all()
}

function getEvent(id: string): any {
  const event = db.prepare(`${SELECT} WHERE e.id = ?`).get(id)
  if (!event) throw new HttpError(404, 'Event not found')
  return event
}

const COLUMNS: Record<string, string> = {
  title: 'title', date: 'starts_at', city: 'city', mode: 'mode', category: 'category',
  description: 'description', registerUrl: 'register_url', sourceUrl: 'source_url', status: 'status',
}

export function updateEvent(id: string, patch: EventPatch) {
  getEvent(id)
  const fields = Object.entries(patch).filter(([key, value]) => value !== undefined && COLUMNS[key])
  if (fields.length) {
    // Column names come from the fixed COLUMNS list above, never from the request.
    const sets = fields.map(([key]) => `${COLUMNS[key]} = ?`).join(', ')
    db.prepare(`UPDATE events SET ${sets} WHERE id = ?`).run(...fields.map(([, v]) => v as string), id)
  }
  return getEvent(id)
}

// "Find people to go with": the first person creates the event's group, everyone after joins it directly.
export function goWith(eventId: string, userId: string) {
  const event = getEvent(eventId)
  if (event.status !== 'published') throw new HttpError(404, 'Event not found')
  return transaction(() => {
    if (!event.groupId) {
      const group = createGroup(userId, {
        name: `Going to ${event.title}`.slice(0, 70),
        description: `Find people to go with to ${event.title}. Official page: ${event.registerUrl}`.slice(0, 400),
        category: event.category,
        mode: event.mode,
        location: event.mode === 'Online' ? 'Online' : event.city || 'Online',
        spots: 49,
      } as any) // event categories (e.g. "Hackathon") are wider than the group form's choices
      db.prepare('UPDATE events SET group_id = ? WHERE id = ?').run(group.id, eventId)
      return group.id
    }
    // Event groups are open: no host approval. If you'd been declined or were pending, you're in now.
    db.prepare(
      `INSERT INTO group_members (group_id, user_id, status) VALUES (?, ?, 'joined')
       ON CONFLICT (group_id, user_id) DO UPDATE SET status = 'joined'`,
    ).run(event.groupId, userId)
    return event.groupId as string
  })
}
