import { db, transaction } from '../../db/connection.ts'
import { HttpError } from '../../middleware/errors.ts'
import { findUser, requireVerified } from '../auth/auth.service.ts'
import { createGroup, getGroup, isMember } from '../groups/groups.service.ts'
import { notify } from '../notifications/notifications.service.ts'
import { requestToJoin } from '../requests/requests.service.ts'
import { isBlocked } from '../safety/safety.service.ts'
import { nameOf } from '../people/people.service.ts'
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
    db.prepare('DELETE FROM crew_match WHERE event_id = ? AND user_id = ?').run(eventId, userId)
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

// Who's going (looking for company or happy to meet people), like Partiful's guest list: it unlocks once
// you say you're going yourself. Before that, only how many. People who block each other don't see each other.
export function whoIsGoing(eventId: string, userId: string) {
  publishedEvent(eventId)
  const people = db
    .prepare(
      `SELECT u.id, u.name FROM event_going g JOIN users u ON u.id = g.user_id
       WHERE g.event_id = ? AND g.intent IN ('company', 'meet') AND u.id != ?
         AND u.id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = ?)
         AND u.id NOT IN (SELECT blocker_id FROM blocks WHERE blocked_id = ?)
       ORDER BY g.created_at`,
    )
    .all(eventId, userId, userId, userId)
  return intentOf(eventId, userId) ? { locked: false, people } : { locked: true, count: people.length }
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
          `SELECT u.id, u.name, m.arrived_at AS arrivedAt FROM group_members m JOIN users u ON u.id = m.user_id
           WHERE m.group_id = ? AND m.status = 'joined'`,
        )
        .all(crew.id) as { id: string; name: string; arrivedAt: number | null }[]
      // The show-up score: did each person tap "I'm here"? Only crews of 2+, where someone else was there too.
      if (people.length > 1)
        for (const p of people)
          db.prepare('INSERT OR IGNORE INTO attendance (user_id, event_id, showed) VALUES (?, ?, ?)').run(
            p.id,
            event.id,
            p.arrivedAt ? 1 : 0,
          )
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

// "Find me a crew", like Timeleft's dinners: instead of picking strangers yourself, Comoonly picks the people
// you have most in common with. First it looks for an open crew for this event (its organizer still says yes);
// with none, you wait, and once 3 people are waiting a crew of up to 4 is formed from the best matches.
const MATCH_MIN = 3
const MATCH_MAX = 4

const shared = (a: string[], b: string[]) => a.filter((x) => b.includes(x))

export function findMeACrew(eventId: string, userId: string, womenOnly: boolean) {
  const event = publishedEvent(eventId)
  requireVerified(userId)
  const me = findUser(userId)
  if (womenOnly && me.gender !== 'woman') throw new HttpError(403, 'Only women can ask for a women-only crew')
  if (inCrew(eventId, userId)) throw new HttpError(409, 'You’re already in a crew for this event')
  return transaction(() => {
    if (!intentOf(eventId, userId)) goTo(eventId, userId, 'company') // being matched means you're going

    // 1. An open crew you can join: the one whose people share most of your interests.
    const crews = listCrews(eventId, userId).filter(
      (c: any) => !c.myStatus && c.members < c.size && (!womenOnly || c.womenOnly) && !isBlocked(c.ownerId, userId),
    )
    let best: { id: string; together: string[] } | undefined
    for (const crew of crews) {
      const together = [...new Set(membersOf(crew.id).flatMap((m) => shared(me.interests, findUser(m).interests)))]
      if (!best || together.length > best.together.length) best = { id: crew.id, together }
    }
    if (best) {
      const why = best.together.length ? ` · you both like ${best.together.slice(0, 2).join(' and ')}` : ''
      requestToJoin(best.id, userId, `✨ Matched by Comoonly${why}. Hi, I’d love to come with you!`)
      return { result: 'requested' as const, crewId: best.id }
    }

    // 2. No open crew: wait, and form a new crew once enough people are waiting.
    db.prepare(
      `INSERT INTO crew_match (event_id, user_id, women_only, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (event_id, user_id) DO UPDATE SET women_only = excluded.women_only`,
    ).run(eventId, userId, womenOnly ? 1 : 0, Date.now())
    const waiting = (
      db
        .prepare(
          'SELECT user_id FROM crew_match WHERE event_id = ? AND women_only = ? AND user_id != ? ORDER BY created_at',
        )
        .all(eventId, womenOnly ? 1 : 0, userId) as { user_id: string }[]
    )
      .map((r) => findUser(r.user_id))
      .filter((u) => !inCrew(eventId, u.id))
      .sort((a, b) => shared(me.interests, b.interests).length - shared(me.interests, a.interests).length)
    const chosen = [me]
    for (const u of waiting)
      if (chosen.length < MATCH_MAX && chosen.every((c) => !isBlocked(c.id, u.id))) chosen.push(u)
    if (chosen.length < MATCH_MIN) return { result: 'waiting' as const, waiting: waiting.length + 1 }

    // Someone who was already waiting organizes; everyone asked to be matched, so all join straight away.
    const [organizer, ...rest] = [...chosen.slice(1), me]
    const crew = createGroup(organizer.id, {
      name: `✨ Matched crew · ${event.title}`.slice(0, 70),
      description: 'Decide together in the chat',
      category: event.category,
      mode: event.mode,
      location: event.city || 'Pakistan',
      spots: MATCH_MAX - 1,
    } as any)
    db.prepare('UPDATE groups SET event_id = ?, women_only = ? WHERE id = ?').run(eventId, womenOnly ? 1 : 0, crew.id)
    for (const u of rest)
      db.prepare("INSERT INTO group_members (group_id, user_id, status) VALUES (?, ?, 'joined')").run(crew.id, u.id)
    for (const u of chosen) db.prepare('DELETE FROM crew_match WHERE event_id = ? AND user_id = ?').run(eventId, u.id)
    const common = shared(chosen[0].interests, chosen[1].interests)
    notify(
      chosen.filter((u) => u.id !== userId).map((u) => u.id),
      'update',
      `✨ You’ve been matched into a crew for ${event.title}` +
        (common.length ? ` (you all like ${common[0]})` : '') +
        '. Say hi!',
      `/groups/${crew.id}?tab=Chat`,
    )
    return { result: 'matched' as const, crewId: crew.id }
  })
}

// Whether you're waiting to be matched for this event, and how many people are waiting in all.
export function matchStatus(eventId: string, userId: string) {
  const row: any = db
    .prepare(
      `SELECT EXISTS (SELECT 1 FROM crew_match WHERE event_id = ? AND user_id = ?) AS waiting,
         (SELECT COUNT(*) FROM crew_match WHERE event_id = ?) AS total`,
    )
    .get(eventId, userId, eventId)
  return { waiting: Boolean(row.waiting), total: row.total as number }
}

export function stopMatching(eventId: string, userId: string) {
  db.prepare('DELETE FROM crew_match WHERE event_id = ? AND user_id = ?').run(eventId, userId)
}

function inCrew(eventId: string, userId: string) {
  return Boolean(
    db
      .prepare(
        `SELECT 1 FROM group_members m JOIN groups g ON g.id = m.group_id
         WHERE g.event_id = ? AND m.user_id = ? AND m.status IN ('joined', 'pending')`,
      )
      .get(eventId, userId),
  )
}

function membersOf(groupId: string) {
  return (
    db.prepare("SELECT user_id FROM group_members WHERE group_id = ? AND status = 'joined'").all(groupId) as {
      user_id: string
    }[]
  ).map((r) => r.user_id)
}

// Event days are Pakistan days, whatever the server's clock zone.
const pakistanToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' })

function crewEvent(groupId: string, userId: string) {
  const group = getGroup(groupId)
  if (!group?.crewFor) throw new HttpError(404, 'Crew not found')
  if (!isMember(groupId, userId)) throw new HttpError(403, 'Join this crew to see this')
  return { group, event: getEvent(group.crewFor) }
}

// "Still coming?": yes, or can't make it (the organizer hears straight away), any time before the event is over.
export function answerStillComing(groupId: string, userId: string, answer: 'yes' | 'no') {
  const { group, event } = crewEvent(groupId, userId)
  if (event.date.slice(0, 10) < pakistanToday()) throw new HttpError(409, 'This event is over')
  db.prepare('UPDATE group_members SET still_coming = ? WHERE group_id = ? AND user_id = ?').run(
    answer,
    groupId,
    userId,
  )
  if (answer === 'no' && group.ownerId !== userId)
    notify(group.ownerId, 'update', `${nameOf(userId)} can’t make it to ${event.title}`, `/groups/${groupId}`)
}

// "I'm here 📍", on the event day only. The rest of the crew hears, so nobody waits at the gate wondering.
// shortcut: trusts the tap (no location check), add a GPS check near the venue if people game the score.
export function imHere(groupId: string, userId: string) {
  const { event } = crewEvent(groupId, userId)
  if (event.date.slice(0, 10) !== pakistanToday()) throw new HttpError(409, 'You can check in on the day of the event')
  db.prepare(
    "UPDATE group_members SET arrived_at = ?, still_coming = 'yes' WHERE group_id = ? AND user_id = ? AND arrived_at IS NULL",
  ).run(Date.now(), groupId, userId)
  notify(
    membersOf(groupId).filter((id) => id !== userId),
    'update',
    `📍 ${nameOf(userId)} is here at ${event.title}`,
    `/groups/${groupId}`,
    true,
  )
}

// Hourly, from 8am Pakistan time on the event day: each crew member is asked "Still coming?" once.
export function askStillComing() {
  if (Number(new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi', hour: 'numeric', hour12: false })) < 8)
    return 0
  const events = db
    .prepare(
      "SELECT id, title FROM events WHERE status = 'published' AND crews_asked = 0 AND substr(starts_at, 1, 10) = ?",
    )
    .all(pakistanToday()) as { id: string; title: string }[]
  for (const event of events) {
    for (const crew of db.prepare('SELECT id FROM groups WHERE event_id = ?').all(event.id) as { id: string }[])
      notify(
        membersOf(crew.id),
        'update',
        `Still coming to ${event.title} today? Let your crew know 👋`,
        `/groups/${crew.id}`,
      )
    db.prepare('UPDATE events SET crews_asked = 1 WHERE id = ?').run(event.id)
  }
  return events.length
}
