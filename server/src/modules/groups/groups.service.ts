import { randomUUID } from 'node:crypto'
import { db, transaction } from '../../db/connection.ts'
import { HttpError } from '../../middleware/errors.ts'
import { notify } from '../notifications/notifications.service.ts'
import { INTERESTS } from '../auth/auth.service.ts'
import type { CreateGroupInput, ListQuery } from './groups.schema.ts'

// One query shape for list and detail, so both return exactly the frontend's GroupPreview.
const SELECT = `
  SELECT g.*, u.name AS owner, COUNT(m.user_id) AS members,
    g.event_id IS NOT NULL OR EXISTS (SELECT 1 FROM events e WHERE e.group_id = g.id) AS forEvent,
    EXISTS (SELECT 1 FROM group_photos p WHERE p.group_id = g.id) AS hasPhoto,
    (SELECT e.id FROM events e WHERE e.id = g.event_id OR e.group_id = g.id) AS eventId,
    (SELECT e.title FROM events e WHERE e.id = g.event_id OR e.group_id = g.id) AS eventTitle
  FROM groups g
  JOIN users u ON u.id = g.owner_id
  LEFT JOIN group_members m ON m.group_id = g.id AND m.status = 'joined'`

// Whitelist: user input picks a key, never raw SQL.
const SORTS = {
  newest: 'g.created_at DESC',
  spots: 'g.capacity - COUNT(m.user_id) DESC, g.created_at DESC',
  popular: 'COUNT(m.user_id) DESC, g.created_at DESC',
}

const COLORS = ['lilac', 'mint', 'pink']

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function toPreview(row: any) {
  return {
    id: row.id,
    name: row.name,
    title: row.title,
    category: row.category,
    description: row.description,
    members: row.members,
    spots: Math.max(row.capacity - row.members, 0),
    location: row.location,
    mode: row.mode,
    owner: row.owner,
    ownerId: row.owner_id,
    initials: initials(row.owner),
    color: row.color,
    forEvent: Boolean(row.forEvent), // an event's "everyone going" group or one of its crews
    crewFor: row.event_id as string | null, // a crew: the event it's going to
    womenOnly: Boolean(row.women_only),
    hasPhoto: Boolean(row.hasPhoto),
    // For an event's groups (everyone going, and crews): which event, so the app can show them together.
    eventId: row.eventId as string | null,
    eventTitle: row.eventTitle as string | null,
    pinned: row.pinned as string,
  }
}

export function listGroups(query: ListQuery) {
  // Each filter adds one condition and its value; values go in as ? parameters, never pasted into SQL.
  const where: string[] = []
  const params: string[] = []
  function filter(condition: string, value: string) {
    where.push(condition)
    params.push(value)
  }
  if (query.category) filter('g.category = ?', query.category)
  if (query.mode) filter('g.mode = ?', query.mode)
  if (query.location) filter('g.location = ?', query.location)
  if (query.q) {
    // Escape % and _ so a search for "50%" means the text "50%", not a wildcard.
    const term = `%${query.q.replace(/[\\%_]/g, '\\$&')}%`
    filter(`(g.title || ' ' || g.description || ' ' || g.category) LIKE ? ESCAPE '\\'`, term)
  }
  const sql = `${SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    GROUP BY g.id ORDER BY ${SORTS[query.sort]} LIMIT ? OFFSET ?`
  return db
    .prepare(sql)
    .all(...params, query.limit, query.offset)
    .map(toPreview)
}

export function getGroup(id: string) {
  const row = db.prepare(`${SELECT} WHERE g.id = ? GROUP BY g.id`).get(id)
  return row ? toPreview(row) : undefined
}

// Used by every members-only feature (members list, chat).
export function requireMember(groupId: string, userId: string) {
  const group = getGroup(groupId)
  if (!group) throw new HttpError(404, 'Group not found')
  if (!isMember(groupId, userId)) throw new HttpError(403, 'Join this group to see this')
  return group
}

export function isMember(groupId: string, userId: string) {
  return Boolean(
    db
      .prepare("SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'joined'")
      .get(groupId, userId),
  )
}

export function listMembers(groupId: string, viewerId: string) {
  const group = requireMember(groupId, viewerId)
  const rows = db
    .prepare(
      `SELECT u.id, u.name FROM group_members m JOIN users u ON u.id = m.user_id
       WHERE m.group_id = ? AND m.status = 'joined' ORDER BY m.rowid`,
    )
    .all(groupId)
  return rows.map((u: any) => ({ ...u, role: u.id === group.ownerId ? 'Organizer' : 'Member' }))
}

export function savedGroupIds(userId: string) {
  return db
    .prepare('SELECT group_id FROM saved_groups WHERE user_id = ?')
    .all(userId)
    .map((r: any) => r.group_id)
}

// Saving twice un-saves, like the bookmark button.
export function toggleSaved(userId: string, groupId: string) {
  if (!getGroup(groupId)) throw new HttpError(404, 'Group not found')
  const removed = db.prepare('DELETE FROM saved_groups WHERE user_id = ? AND group_id = ?').run(userId, groupId)
  if (!removed.changes) db.prepare('INSERT INTO saved_groups (user_id, group_id) VALUES (?, ?)').run(userId, groupId)
  return savedGroupIds(userId)
}

export function createGroup(ownerId: string, input: CreateGroupInput) {
  const id = randomUUID()
  const location = input.mode === 'Online' ? 'Online' : input.location
  const color = COLORS[Math.floor(Math.random() * COLORS.length)]
  // Group and its first member (the owner) are saved together or not at all.
  transaction(() => {
    db.prepare(
      `INSERT INTO groups (id, owner_id, name, title, description, category, mode, location, capacity, color, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      ownerId,
      input.name,
      input.name,
      input.description,
      input.category,
      input.mode,
      location,
      input.spots + 1,
      color,
      Date.now(),
    )
    db.prepare('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)').run(id, ownerId)
  })
  return getGroup(id)!
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

// Tell people about a new community that matches one of their interests, in their city (or online).
// shortcut: checks every user in memory, fine for thousands of people, move matching into SQL beyond that.
export function announceGroup(group: ReturnType<typeof toPreview>) {
  const users = db.prepare(`SELECT u.id, u.city, ${INTERESTS} FROM users u WHERE u.id != ?`).all(group.ownerId) as any[]
  const nearby = (city: string) =>
    group.mode === 'Online' || !city || city.toLowerCase() === group.location.toLowerCase()
  const ids = users
    .filter((u) => nearby(u.city) && JSON.parse(u.interests).some((i: string) => same(i, group.category)))
    .map((u) => u.id)
  const where = group.mode === 'Online' ? 'online' : `in ${group.location}`
  if (ids.length)
    notify(ids, 'update', `A new ${group.category} community started ${where}: ${group.name}`, `/posts/${group.id}`)
}

export function setPinned(groupId: string, userId: string, pinned: string) {
  requireMember(groupId, userId)
  db.prepare('UPDATE groups SET pinned = ? WHERE id = ?').run(pinned, groupId)
}

// "Same crew next time?": the organizer keeps the crew as a community. It leaves the event (so it isn't
// deleted with it a week later), gets an interest and room to grow, and its chat and members stay.
export function keepCrew(groupId: string, userId: string, input: { name: string; category: string }) {
  const group = getGroup(groupId)
  if (!group?.crewFor) throw new HttpError(404, 'Crew not found')
  if (group.ownerId !== userId) throw new HttpError(403, 'Only the organizer can do this')
  db.prepare(
    'UPDATE groups SET event_id = NULL, name = ?, title = ?, category = ?, capacity = MAX(capacity, 30) WHERE id = ?',
  ).run(input.name, input.name, input.category, groupId)
  const others = db
    .prepare("SELECT user_id FROM group_members WHERE group_id = ? AND status = 'joined' AND user_id != ?")
    .all(groupId, userId)
    .map((r: any) => r.user_id)
  notify(others, 'update', `Same crew next time! ${input.name} is now a community`, `/groups/${groupId}`)
  return getGroup(groupId)!
}
