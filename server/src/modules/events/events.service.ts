import { randomUUID } from 'node:crypto'
import { db, transaction } from '../../db/connection.ts'
import { HttpError } from '../../middleware/errors.ts'
import { createGroup, getGroup, isMember } from '../groups/groups.service.ts'
import { INTERESTS } from '../auth/auth.service.ts'
import { notify } from '../notifications/notifications.service.ts'
import type { EventInput, EventPatch } from './events.schema.ts'

const SELECT = `SELECT e.id, e.title, e.starts_at AS date, e.deadline, e.city, e.mode, e.category, e.description,
    e.register_url AS registerUrl, e.source_url AS sourceUrl, e.status, e.group_id AS groupId,
    (SELECT name FROM users WHERE id = e.suggested_by) AS suggestedBy,
    (SELECT COUNT(*) FROM group_members m WHERE m.group_id = e.group_id AND m.status = 'joined') AS goingCount,
    EXISTS (SELECT 1 FROM event_posters p WHERE p.event_id = e.id) AS hasPoster
  FROM events e`

// Dates are ISO text (2026-11-02 or 2026-11-02T18:00), so comparing them as text works.
const today = () => new Date().toISOString().slice(0, 10)
const STILL_ON = "e.starts_at >= ? AND (e.deadline = '' OR e.deadline >= ?)"

// Returns false for a duplicate, so nothing is saved twice. The same event is often listed on several
// pages (e.g. an online talk on both the Lahore and Karachi pages), so its own link counts too.
// Words too common to tell two events apart.
const COMMON = new Set(
  'live concert event events night show music festival workshop meetup summit with featuring and the for lahore karachi islamabad pakistan'.split(
    ' ',
  ),
)
const words = (title: string) =>
  new Set(
    title
      .toLowerCase()
      .match(/[\p{L}\p{N}]{3,}/gu)
      ?.filter((w) => !COMMON.has(w) && !/^\d+$/.test(w)),
  )

// The same event is often posted by several accounts with different titles ("Prem Nagar Charity Concert",
// "Prem Nagar - Live Concert featuring..."). Same day + same city + 2 shared distinctive title words = same event.
function looksLikeDuplicate(input: EventInput) {
  const mine = words(input.title)
  const sameDay = db
    .prepare('SELECT title FROM events WHERE substr(starts_at, 1, 10) = ? AND lower(city) = lower(?)')
    .all(input.date.slice(0, 10), input.city) as { title: string }[]
  return sameDay.some(({ title }) => [...words(title)].filter((w) => mine.has(w)).length >= 2)
}

export function saveEvent(
  input: EventInput,
  status: 'draft' | 'published' = 'draft',
  suggestedBy: string | null = null,
) {
  // Found and suggested events only; an admin adding one by hand knows what they're doing.
  if (status === 'draft' && looksLikeDuplicate(input)) return false
  const id = randomUUID()
  const result = db
    .prepare(
      `INSERT OR IGNORE INTO events (id, title, starts_at, deadline, city, mode, category, description, register_url, source_url,
         status, suggested_by, created_at)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       WHERE NOT EXISTS (SELECT 1 FROM events WHERE register_url = ? OR (title = ? AND starts_at = ?))`,
    )
    .run(
      id,
      input.title,
      input.date,
      input.deadline,
      input.city,
      input.mode,
      input.category,
      input.description,
      input.registerUrl,
      input.sourceUrl,
      status,
      suggestedBy,
      Date.now(),
      input.registerUrl,
      input.title,
      input.date,
    )
  if (result.changes && status === 'published') announce(getEvent(id))
  return result.changes > 0 && id // the new event's id, or false for a duplicate
}

// shortcut: posters live in the database as bytes (a few hundred KB each), move them to file storage
// (e.g. Cloudflare R2) if there are thousands.
export function savePoster(eventId: string, dataUrl: string) {
  const [, mime, base64] = dataUrl.match(/^data:([^;]+);base64,(.+)$/)!
  db.prepare(
    `INSERT INTO event_posters (event_id, mime, bytes) VALUES (?, ?, ?)
     ON CONFLICT (event_id) DO UPDATE SET mime = excluded.mime, bytes = excluded.bytes`,
  ).run(eventId, mime, Buffer.from(base64, 'base64'))
}

export function getPoster(eventId: string) {
  return db.prepare('SELECT mime, bytes FROM event_posters WHERE event_id = ?').get(eventId) as
    { mime: string; bytes: Uint8Array } | undefined
}

// The event an event group was made for, shown at the top of that group.
export function eventForGroup(groupId: string) {
  const event = db.prepare(`${SELECT} WHERE e.group_id = ? AND e.status = 'published'`).get(groupId)
  if (!event) throw new HttpError(404, 'Event not found')
  return event
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
  const users = db.prepare(`SELECT u.id, u.city, ${INTERESTS} FROM users u`).all() as any[]
  const nearby = (city: string) =>
    event.mode !== 'In person' || !event.city || !city || city.toLowerCase() === event.city.toLowerCase()
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

// Runs every 12 hours: drafts nobody reviewed before the event (or deadline) are deleted, rejected events
// after 30 days, published events (and their groups) 7 days after the event, and the list of
// already-read Instagram posts after 30 days. Published events leave the Events page once registration closes.
export function tidyEvents() {
  const monthAgo = Date.now() - 30 * 86_400_000
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10)
  const drafts = db
    .prepare(`DELETE FROM events AS e WHERE status = 'draft' AND NOT (${STILL_ON})`)
    .run(today(), today()).changes
  const rejected = db.prepare("DELETE FROM events WHERE status = 'rejected' AND created_at < ?").run(monthAgo).changes
  const over = db.prepare("SELECT id FROM events WHERE status = 'published' AND starts_at < ?").all(weekAgo)
  for (const e of over as { id: string }[]) deleteEvent(e.id)
  db.prepare('DELETE FROM seen_posts WHERE seen_at < ?').run(monthAgo)
  return { drafts, rejected, finished: over.length }
}

// An event goes with its "go together" group: the group only made sense for this event.
export function deleteEvent(id: string) {
  transaction(() => {
    const row: any = db.prepare('SELECT group_id FROM events WHERE id = ?').get(id)
    if (!row) throw new HttpError(404, 'Event not found')
    db.prepare('DELETE FROM events WHERE id = ?').run(id)
    if (row.group_id) db.prepare('DELETE FROM groups WHERE id = ?').run(row.group_id)
  })
}

export function getEvent(id: string): any {
  const event = db.prepare(`${SELECT} WHERE e.id = ?`).get(id)
  if (!event) throw new HttpError(404, 'Event not found')
  return event
}

const COLUMNS: Record<string, string> = {
  title: 'title',
  date: 'starts_at',
  deadline: 'deadline',
  city: 'city',
  mode: 'mode',
  category: 'category',
  description: 'description',
  registerUrl: 'register_url',
  sourceUrl: 'source_url',
  status: 'status',
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
        location: event.mode === 'Online' ? 'Online' : event.city || 'Pakistan',
        spots: 49,
      } as any) // event categories (e.g. "Hackathon") are wider than the group form's choices
      db.prepare('UPDATE events SET group_id = ? WHERE id = ?').run(group.id, eventId)
      return group.id
    }
    // Event groups are open: no host approval. If you'd been declined or were pending, you're in now.
    if (!isMember(event.groupId, userId) && getGroup(event.groupId)?.spots === 0) {
      throw new HttpError(409, 'This event group is full')
    }
    db.prepare(
      `INSERT INTO group_members (group_id, user_id, status) VALUES (?, ?, 'joined')
       ON CONFLICT (group_id, user_id) DO UPDATE SET status = 'joined'`,
    ).run(event.groupId, userId)
    return event.groupId as string
  })
}
