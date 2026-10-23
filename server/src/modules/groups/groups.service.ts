import { randomUUID } from 'node:crypto'
import { db, transaction } from '../../db/connection.ts'
import { HttpError } from '../../middleware/errors.ts'
import type { CreateGroupInput, ListQuery } from './groups.schema.ts'

// One query shape for list and detail, so both return exactly the frontend's GroupPreview.
const SELECT = `
  SELECT g.*, u.name AS owner, COUNT(m.user_id) AS members
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

// Used by every members-only feature (members list, chat, activities, to-dos).
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
