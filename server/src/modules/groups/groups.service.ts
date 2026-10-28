import { randomUUID } from 'node:crypto'
import { db, transaction } from '../../db/connection.ts'
import { HttpError } from '../../middleware/errors.ts'
import { notify } from '../notifications/notifications.service.ts'
import { INTERESTS } from '../auth/auth.service.ts'
import { nameOf } from '../people/people.service.ts'
import type { CreateGroupInput, ListQuery } from './groups.schema.ts'

// One query shape for list and detail, so both return exactly the frontend's GroupPreview.
const SELECT = `
  SELECT g.*, u.name AS owner, COUNT(m.user_id) AS members,
    g.event_id IS NOT NULL OR EXISTS (SELECT 1 FROM events e WHERE e.group_id = g.id) AS forEvent,
    EXISTS (SELECT 1 FROM group_photos p WHERE p.group_id = g.id) AS hasPhoto,
    (SELECT e.id FROM events e WHERE e.id = g.event_id OR e.group_id = g.id) AS eventId,
    (SELECT e.title FROM events e WHERE e.id = g.event_id OR e.group_id = g.id) AS eventTitle,
    p.stage, p.stopped, p.story, p.needs, p.status AS projectStatus, p.free_to_adopt AS freeToAdopt,
    p.started_by AS startedById, su.name AS startedBy
  FROM groups g
  JOIN users u ON u.id = g.owner_id
  LEFT JOIN projects p ON p.group_id = g.id
  LEFT JOIN users su ON su.id = p.started_by
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
    // The Idea Graveyard: an unfinished project's details, or null for communities, event chats and crews.
    project:
      row.kind === 'project'
        ? {
            stage: row.stage as string,
            stopped: row.stopped as string,
            story: row.story as string,
            needs: JSON.parse(row.needs) as string[],
            status: row.projectStatus as string,
            freeToAdopt: Boolean(row.freeToAdopt),
            startedById: row.startedById as string | null, // the original creator, even after adoption
            startedBy: row.startedBy as string | null,
          }
        : null,
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
      `SELECT u.id, u.name, m.area, m.still_coming AS stillComing, m.arrived_at AS arrivedAt
       FROM group_members m JOIN users u ON u.id = m.user_id
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
    if (input.project) {
      const p = input.project
      db.prepare("UPDATE groups SET kind = 'project' WHERE id = ?").run(id)
      db.prepare(
        'INSERT INTO projects (group_id, stage, stopped, story, needs, free_to_adopt, started_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).run(id, p.stage, p.stopped, p.story, JSON.stringify(p.needs), p.freeToAdopt ? 1 : 0, ownerId)
      addHistory(id, '🪦', `${nameOf(ownerId)} laid it to rest, hoping someone picks it up`)
    }
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
  const text = group.project
    ? `An unfinished ${group.category} idea needs a second life: ${group.name}`
    : `A new ${group.category} community started ${where}: ${group.name}`
  if (ids.length) notify(ids, 'update', text, `/posts/${group.id}`)
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

export function setArea(groupId: string, userId: string, area: string) {
  requireMember(groupId, userId)
  db.prepare('UPDATE group_members SET area = ? WHERE group_id = ? AND user_id = ?').run(area, groupId, userId)
}

// Shared costs, like Splitwise: every expense is split equally between the members, and `settle` says
// who pays whom so everyone is even, in as few payments as it takes.
export function expenses(groupId: string, userId: string) {
  requireMember(groupId, userId)
  const list = db
    .prepare(
      `SELECT e.id, e.what, e.amount, e.payer_id AS payerId, u.name AS payer FROM expenses e
       JOIN users u ON u.id = e.payer_id WHERE e.group_id = ? ORDER BY e.created_at`,
    )
    .all(groupId) as { id: string; what: string; amount: number; payerId: string; payer: string }[]
  const members = listMembers(groupId, userId)
  const total = list.reduce((sum, e) => sum + e.amount, 0)
  const balance = new Map(members.map((m: any) => [m.id, -total / members.length]))
  for (const e of list) balance.set(e.payerId, (balance.get(e.payerId) ?? 0) + e.amount)
  const name = (id: string) => members.find((m: any) => m.id === id)?.name ?? 'Someone who left'
  const owes = [...balance].filter(([, b]) => b < -0.5).map(([id, b]) => ({ id, left: -b }))
  const gets = [...balance].filter(([, b]) => b > 0.5).map(([id, b]) => ({ id, left: b }))
  const settle = []
  for (const debtor of owes)
    for (const creditor of gets) {
      const amount = Math.min(debtor.left, creditor.left)
      if (Math.round(amount) < 1) continue
      settle.push({ from: name(debtor.id), to: name(creditor.id), amount: Math.round(amount) })
      debtor.left -= amount
      creditor.left -= amount
    }
  return { expenses: list, total, settle }
}

export function addExpense(groupId: string, userId: string, what: string, amount: number) {
  requireMember(groupId, userId)
  db.prepare('INSERT INTO expenses (id, group_id, payer_id, what, amount, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    randomUUID(),
    groupId,
    userId,
    what,
    amount,
    Date.now(),
  )
}

// Only whoever paid can take an expense back off the list.
export function deleteExpense(groupId: string, userId: string, expenseId: string) {
  requireMember(groupId, userId)
  const removed = db
    .prepare('DELETE FROM expenses WHERE id = ? AND group_id = ? AND payer_id = ?')
    .run(expenseId, groupId, userId)
  if (!removed.changes) throw new HttpError(404, 'Expense not found')
}

// ── The Idea Graveyard ──────────────────────────────────────────────────────────────────────────────

export function addHistory(groupId: string, emoji: string, text: string) {
  db.prepare('INSERT INTO project_history (id, group_id, emoji, text, created_at) VALUES (?, ?, ?, ?, ?)').run(
    randomUUID(),
    groupId,
    emoji,
    text,
    Date.now(),
  )
}

export function projectHistory(groupId: string) {
  return db
    .prepare('SELECT emoji, text, created_at AS createdAt FROM project_history WHERE group_id = ? ORDER BY created_at')
    .all(groupId)
}

function findProject(groupId: string) {
  const group = getGroup(groupId)
  if (!group?.project) throw new HttpError(404, 'Project not found')
  return group
}

// Someone joined to help: the project is being revived (called when the owner accepts a helper).
export function helperJoined(groupId: string, userId: string) {
  addHistory(groupId, '🤝', `${nameOf(userId)} joined to help`)
  db.prepare("UPDATE projects SET status = 'reviving' WHERE group_id = ? AND status = 'resting'").run(groupId)
}

// Taking a project over. "Free to adopt" projects are yours straight away; otherwise the owner decides.
export function askToAdopt(groupId: string, userId: string, note: string) {
  const group = findProject(groupId)
  if (group.ownerId === userId) throw new HttpError(409, 'It’s already yours')
  if (group.project!.freeToAdopt) return (adopt(group, userId), 'adopted')
  db.prepare(
    `INSERT INTO adoption_requests (group_id, user_id, note, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (group_id, user_id) DO UPDATE SET note = excluded.note`,
  ).run(groupId, userId, note, Date.now())
  notify(group.ownerId, 'update', `${nameOf(userId)} would like to adopt ${group.name}`, `/groups/${groupId}`)
  return 'pending'
}

export function adoptionRequests(groupId: string, ownerId: string) {
  if (findProject(groupId).ownerId !== ownerId) throw new HttpError(403, 'Only the owner can see this')
  return db
    .prepare(
      `SELECT u.id, u.name, a.note FROM adoption_requests a JOIN users u ON u.id = a.user_id
       WHERE a.group_id = ? ORDER BY a.created_at`,
    )
    .all(groupId)
}

export function decideAdoption(groupId: string, ownerId: string, userId: string, accept: boolean) {
  const group = findProject(groupId)
  if (group.ownerId !== ownerId) throw new HttpError(403, 'Only the owner can do this')
  const removed = db.prepare('DELETE FROM adoption_requests WHERE group_id = ? AND user_id = ?').run(groupId, userId)
  if (!removed.changes) throw new HttpError(404, 'Request not found')
  if (accept) adopt(group, userId)
}

// The new owner takes over; the old one stays on as a member, and the original creator stays credited.
function adopt(group: ReturnType<typeof findProject>, userId: string) {
  transaction(() => {
    db.prepare(
      `INSERT INTO group_members (group_id, user_id, status) VALUES (?, ?, 'joined')
       ON CONFLICT (group_id, user_id) DO UPDATE SET status = 'joined'`,
    ).run(group.id, userId)
    db.prepare('UPDATE groups SET owner_id = ? WHERE id = ?').run(userId, group.id)
    db.prepare("UPDATE projects SET status = 'reviving' WHERE group_id = ? AND status = 'resting'").run(group.id)
    db.prepare('DELETE FROM adoption_requests WHERE group_id = ?').run(group.id)
    addHistory(group.id, '🔁', `Adopted by ${nameOf(userId)}`)
  })
  notify(
    group.ownerId,
    'update',
    `${nameOf(userId)} adopted ${group.name}. It’s getting a second life!`,
    `/groups/${group.id}`,
  )
  notify(userId, 'update', `${group.name} is yours now. Give it a second life 🌱`, `/groups/${group.id}`)
}

// The owner says where it stands; "alive" is the happy ending.
export function setProjectStatus(groupId: string, ownerId: string, status: 'resting' | 'reviving' | 'alive') {
  const group = findProject(groupId)
  if (group.ownerId !== ownerId) throw new HttpError(403, 'Only the owner can do this')
  db.prepare('UPDATE projects SET status = ? WHERE group_id = ?').run(status, groupId)
  const [emoji, text] = {
    resting: ['🪦', 'Back to resting'],
    reviving: ['🌱', 'Being revived'],
    alive: ['✨', 'Alive again!'],
  }[status]
  addHistory(groupId, emoji, text)
}
