import { randomUUID } from 'node:crypto'
import { db, transaction } from '../../db/connection.ts'
import { HttpError } from '../../middleware/errors.ts'
import { createGroup } from '../groups/groups.service.ts'
import { notify } from '../notifications/notifications.service.ts'
import type { EventInput, EventPatch } from './events.schema.ts'

const SELECT = `SELECT e.id, e.title, e.starts_at AS date, e.deadline, e.city, e.mode, e.category, e.description,
    e.register_url AS registerUrl, e.source_url AS sourceUrl, e.status, e.group_id AS groupId,
    (SELECT name FROM users WHERE id = e.suggested_by) AS suggestedBy,
    (SELECT COUNT(*) FROM group_members m WHERE m.group_id = e.group_id AND m.status = 'joined') AS goingCount
  FROM events e`

// Dates are ISO text (2026-11-02 or 2026-11-02T18:00), so comparing them as text works.
const today = () => new Date().toISOString().slice(0, 10)
const STILL_ON = "e.starts_at >= ? AND (e.deadline = '' OR e.deadline >= ?)"

// Returns false for a duplicate, so nothing is saved twice. The same event is often listed on several
// pages (e.g. an online talk on both the Lahore and Karachi pages), so its own link counts too.
export function saveEvent(input: EventInput, status: 'draft' | 'published' = 'draft', suggestedBy: string | null = null) {
  const id = randomUUID()
  const result = db
    .prepare(
      `INSERT OR IGNORE INTO events (id, title, starts_at, deadline, city, mode, category, description, register_url, source_url,
         status, suggested_by, created_at)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       WHERE NOT EXISTS (SELECT 1 FROM events WHERE register_url = ? OR (title = ? AND starts_at = ?))`,
    )
    .run(id, input.title, input.date, input.deadline, input.city, input.mode, input.category, input.description,
      input.registerUrl, input.sourceUrl, status, suggestedBy, Date.now(), input.registerUrl, input.title, input.date)
  if (result.changes && status === 'published') announce(getEvent(id))
  return result.changes > 0
}

// "Hackathons" in someone's interests matches a Hackathon; "Music" matches an event mentioning music.
function interested(interest: string, event: any) {
  const word = interest.toLowerCase().replace(/s$/, '')
  if (word === event.category.toLowerCase()) return true
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\b${escaped}`, 'i').test(`${event.title} ${event.description}`)
}

// Tell people about a newly published event that matches their interests.
// In-person events only go to people in that city (or who haven't set one).
// shortcut: checks every user in memory, fine for thousands of people, move matching into SQL beyond that.
function announce(event: any) {
  const users = db.prepare('SELECT id, city, interests FROM users').all() as any[]
  const nearby = (city: string) => event.mode !== 'In person' || !event.city || !city || city.toLowerCase() === event.city.toLowerCase()
  const ids = users
    .filter((u) => nearby(u.city) && JSON.parse(u.interests).some((i: string) => interested(i, event)))
    .map((u) => u.id)
  if (ids.length) notify(ids, 'update', `New ${event.category.toLowerCase()} you might like: ${event.title}`, '/events')
}

// Public feed: published, not over yet, and registration still open.
export function listPublished() {
  return db.prepare(`${SELECT} WHERE e.status = 'published' AND ${STILL_ON} ORDER BY e.starts_at`).all(today(), today())
}

export function listDrafts() {
  return db.prepare(`${SELECT} WHERE e.status = 'draft' AND ${STILL_ON} ORDER BY e.starts_at`).all(today(), today())
}

// Runs daily: drafts nobody reviewed before the event (or deadline) are deleted, rejected events after 30 days,
// and the list of already-read Instagram posts after 30 days. Published events stay, as history.
export function tidyEvents() {
  const monthAgo = Date.now() - 30 * 86_400_000
  const drafts = db.prepare(`DELETE FROM events AS e WHERE status = 'draft' AND NOT (${STILL_ON})`).run(today(), today()).changes
  const rejected = db.prepare("DELETE FROM events WHERE status = 'rejected' AND created_at < ?").run(monthAgo).changes
  db.prepare('DELETE FROM seen_posts WHERE seen_at < ?').run(monthAgo)
  return { drafts, rejected }
}

function getEvent(id: string): any {
  const event = db.prepare(`${SELECT} WHERE e.id = ?`).get(id)
  if (!event) throw new HttpError(404, 'Event not found')
  return event
}

const COLUMNS: Record<string, string> = {
  title: 'title', date: 'starts_at', deadline: 'deadline', city: 'city', mode: 'mode', category: 'category',
  description: 'description', registerUrl: 'register_url', sourceUrl: 'source_url', status: 'status',
}

export function updateEvent(id: string, patch: EventPatch) {
  const before = getEvent(id)
  const fields = Object.entries(patch).filter(([key, value]) => value !== undefined && COLUMNS[key])
  if (fields.length) {
    // Column names come from the fixed COLUMNS list above, never from the request.
    const sets = fields.map(([key]) => `${COLUMNS[key]} = ?`).join(', ')
    db.prepare(`UPDATE events SET ${sets} WHERE id = ?`).run(...fields.map(([, v]) => v as string), id)
  }
  const after = getEvent(id)
  if (after.status === 'published' && before.status !== 'published') announce(after)
  return after
}

// "Find people to go with": the first person creates the event's group, everyone after joins it directly.
export function goWith(eventId: string, userId: string) {
  const event = getEvent(eventId)
  if (event.status !== 'published') throw new HttpError(404, 'Event not found')
  return transaction(() => {
    if (!event.groupId) {
      const group = createGroup(userId, {
        name: `Going to ${event.title}`.slice(0, 70),
        description: `Find people to go with to ${event.title}. Plan together, then go together.`.slice(0, 400),
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
