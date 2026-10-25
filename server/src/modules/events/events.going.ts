import { db, transaction } from '../../db/connection.ts'
import { HttpError } from '../../middleware/errors.ts'
import { findUser, requireVerified } from '../auth/auth.service.ts'
import { createGroup, getGroup, isMember } from '../groups/groups.service.ts'
import { notify } from '../notifications/notifications.service.ts'
import { getEvent } from './events.service.ts'
import type { CrewInput, Intent } from './events.schema.ts'

function publishedEvent(eventId: string) {
  const event = getEvent(eventId)
  if (event.status !== 'published') throw new HttpError(404, 'Event not found')
  return event
}

// "I want to go", with how: looking for company or happy to meet people puts you in the event's
// "everyone going" group (the first person creates it); going with your own friends doesn't.
export function goTo(eventId: string, userId: string, intent: Intent) {
  const event = publishedEvent(eventId)
  return transaction(() => {
    db.prepare(
      `INSERT INTO event_going (event_id, user_id, intent, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (event_id, user_id) DO UPDATE SET intent = excluded.intent`,
    ).run(eventId, userId, intent, Date.now())
    if (intent === 'friends') return null
    if (!event.groupId) {
      const group = createGroup(userId, {
        name: `Going to ${event.title}`.slice(0, 70),
        description: `Everyone from Comoonly going to ${event.title}. Say hi, ask questions, find a crew.`.slice(
          0,
          400,
        ),
        category: event.category,
        mode: event.mode,
        location: event.mode === 'Online' ? 'Online' : event.city || 'Pakistan',
        spots: 499,
      } as any) // event categories (e.g. "Hackathon") are wider than the group form's choices
      db.prepare('UPDATE events SET group_id = ? WHERE id = ?').run(group.id, eventId)
      return group.id
    }
    // The everyone-going group is open: no host approval.
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

// Not going after all: off the list and out of the everyone-going group (crews you can leave yourself).
export function notGoing(eventId: string, userId: string) {
  const event = getEvent(eventId)
  transaction(() => {
    db.prepare('DELETE FROM event_going WHERE event_id = ? AND user_id = ?').run(eventId, userId)
    if (event.groupId)
      db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ? AND user_id != ?').run(
        event.groupId,
        userId,
        getGroup(event.groupId)?.ownerId ?? '', // whoever started the group stays its owner
      )
  })
}

export function intentOf(eventId: string, userId: string) {
  const row: any = db.prepare('SELECT intent FROM event_going WHERE event_id = ? AND user_id = ?').get(eventId, userId)
  return (row?.intent ?? null) as Intent | null
}

// Your going choice for every event, for the event lists.
export function intentsOf(userId: string) {
  const rows = db.prepare('SELECT event_id, intent FROM event_going WHERE user_id = ?').all(userId) as any[]
  return new Map<string, Intent>(rows.map((r) => [r.event_id, r.intent]))
}

// An event's crews. Women-only ones are only shown to women.
export function listCrews(eventId: string, userId: string) {
  const isWoman = findUser(userId).gender === 'woman'
  return db
    .prepare(
      `SELECT g.id, g.description AS plan, g.location AS area, g.capacity AS size, g.women_only AS womenOnly,
         g.owner_id AS ownerId, u.name AS owner,
         (SELECT COUNT(*) FROM group_members m WHERE m.group_id = g.id AND m.status = 'joined') AS members,
         (SELECT status FROM group_members m WHERE m.group_id = g.id AND m.user_id = ?) AS myStatus
       FROM groups g JOIN users u ON u.id = g.owner_id
       WHERE g.event_id = ? AND (g.women_only = 0 OR ?) ORDER BY g.created_at`,
    )
    .all(userId, eventId, isWoman ? 1 : 0)
    .map((c: any) => ({ ...c, womenOnly: Boolean(c.womenOnly) }))
}

// Starting a crew: you're its organizer and decide who joins (the normal group join requests).
export function createCrew(eventId: string, userId: string, input: CrewInput) {
  const event = publishedEvent(eventId)
  requireVerified(userId)
  const me = findUser(userId)
  if (input.womenOnly && me.gender !== 'woman') throw new HttpError(403, 'Only women can start a women-only crew')
  if (db.prepare('SELECT 1 FROM groups WHERE event_id = ? AND owner_id = ?').get(eventId, userId))
    throw new HttpError(409, 'You already organize a crew for this event')
  return transaction(() => {
    if (!intentOf(eventId, userId)) goTo(eventId, userId, 'company') // starting a crew means you're going
    const crew = createGroup(userId, {
      name: `${me.name.split(' ')[0]}’s crew · ${event.title}`.slice(0, 70),
      description: input.plan,
      category: event.category,
      mode: event.mode,
      location: input.area || event.city || 'Pakistan',
      spots: input.size - 1,
    } as any)
    db.prepare('UPDATE groups SET event_id = ?, women_only = ? WHERE id = ?').run(
      eventId,
      input.womenOnly ? 1 : 0,
      crew.id,
    )
    return crew.id
  })
}

// After an event (run with the tidy-up): each crew member hears who they went with, so they can connect.
export function followUpCrews() {
  const today = new Date().toISOString().slice(0, 10)
  const events = db
    .prepare("SELECT id, title FROM events WHERE status = 'published' AND followed_up = 0 AND starts_at < ?")
    .all(today) as { id: string; title: string }[]
  for (const event of events) {
    const crews = db.prepare('SELECT id FROM groups WHERE event_id = ?').all(event.id) as { id: string }[]
    for (const crew of crews) {
      const people = db
        .prepare(
          `SELECT u.id, u.name FROM group_members m JOIN users u ON u.id = m.user_id
           WHERE m.group_id = ? AND m.status = 'joined'`,
        )
        .all(crew.id) as { id: string; name: string }[]
      for (const person of people) {
        const others = people.filter((p) => p.id !== person.id).map((p) => p.name.split(' ')[0])
        if (!others.length) continue
        const names = others.length > 1 ? `${others.slice(0, -1).join(', ')} and ${others.at(-1)}` : others[0]
        notify(
          person.id,
          'update',
          `You went to ${event.title} with ${names}. Say thanks and connect!`,
          `/groups/${crew.id}?tab=Members`,
        )
      }
    }
    db.prepare('UPDATE events SET followed_up = 1 WHERE id = ?').run(event.id)
  }
  return events.length
}
