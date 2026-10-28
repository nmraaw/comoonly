import { config } from '../../config.ts'
import { db } from '../../db/connection.ts'
import { findUser } from '../auth/auth.service.ts'
import { chat } from './events.ai.ts'
import { interested, listPublished } from './events.service.ts'

// "✨ Plan my weekend": 1 to 3 events for this weekend (Friday to Sunday, Pakistan time) that fit your
// interests, city and budget, each with a reason. The AI picks and explains; without it (or if its answer
// doesn't make sense), a simple rule does: interests first, then cheaper, then where people are going.

const DAY = 86_400_000
const pakistanDay = (t: number) => new Date(t).toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' })

// The coming weekend: today if it's already Friday to Sunday, else the next Friday.
export function weekend(now = Date.now()) {
  const weekday = new Date(pakistanDay(now)).getUTCDay() // 0 Sunday … 6 Saturday
  const toFriday = weekday === 0 ? -2 : 5 - weekday // Sunday: the Friday just gone
  const friday = now + toFriday * DAY
  return { from: pakistanDay(Math.max(friday, now)), to: pakistanDay(friday + 2 * DAY) }
}

type Pick = { id: string; why: string }

export async function planWeekend(userId: string) {
  const me = findUser(userId)
  const near = (e: any) =>
    e.mode !== 'In person' || !e.city || !me.city || e.city.toLowerCase() === me.city.toLowerCase()
  const upcoming = (listPublished() as any[]).filter(near)
  let { from, to } = weekend()
  let when = 'this weekend'
  let options = upcoming.filter((e) => e.date.slice(0, 10) >= from && e.date.slice(0, 10) <= to)
  if (!options.length) {
    // Nothing on this weekend: the coming week instead.
    ;[from, to, when] = [pakistanDay(Date.now()), pakistanDay(Date.now() + 7 * DAY), 'this week']
    options = upcoming.filter((e) => e.date.slice(0, 10) >= from && e.date.slice(0, 10) <= to)
  }
  if (!options.length) return { when, intro: '', picks: [] }
  const openCrews = (id: string) =>
    (
      db
        .prepare(
          `SELECT COUNT(*) AS n FROM groups g WHERE g.event_id = ?
           AND g.capacity > (SELECT COUNT(*) FROM group_members m WHERE m.group_id = g.id AND m.status = 'joined')`,
        )
        .get(id) as { n: number }
    ).n
  const facts = options.map((e) => ({
    id: e.id,
    title: e.title,
    date: e.date,
    category: e.category,
    price: e.price,
    going: e.goingCount,
    openCrews: openCrews(e.id),
  }))

  const picks = (config.ai.baseUrl && (await askForPlan(me, facts, when).catch(() => null))) || byRule(me, facts)
  const byId = new Map(options.map((e) => [e.id, e]))
  return {
    when,
    intro: picks.intro,
    picks: picks.picks.filter((p) => byId.has(p.id)).map((p) => ({ event: byId.get(p.id), why: p.why })),
  }
}

async function askForPlan(me: ReturnType<typeof findUser>, facts: object[], when: string) {
  const reply = await chat(
    `You plan a fun, realistic ${when} for a young person in Pakistan using a friend-finding app. From the events
given, pick 1 to 3 that fit them best (interests first, then budget; no two at the same time). Reply with ONLY
JSON: {"intro": one warm sentence under 120 characters, "picks": [{"id": the event's id, "why": one short sentence
under 120 characters, mentioning open crews or people going when there are some}]}. Use only the ids given.`,
    JSON.stringify({ interests: me.interests, city: me.city, events: facts }),
  )
  const plan = JSON.parse(reply.slice(reply.indexOf('{'), reply.lastIndexOf('}') + 1))
  if (!Array.isArray(plan.picks) || !plan.picks.length) return null
  return {
    intro: String(plan.intro ?? '').slice(0, 160),
    picks: (plan.picks as Pick[])
      .slice(0, 3)
      .map((p) => ({ id: String(p.id), why: String(p.why ?? '').slice(0, 160) })),
  }
}

// Without the AI: what matches your interests, then the cheapest, then where people are going.
export function byRule(me: { interests: string[] }, facts: any[]) {
  const liked = (e: any) => me.interests.find((i) => interested(i, { ...e, description: '' }))
  const ranked = [...facts].sort(
    (a, b) =>
      Number(Boolean(liked(b))) - Number(Boolean(liked(a))) || (a.price ?? 1e9) - (b.price ?? 1e9) || b.going - a.going,
  )
  return {
    intro: 'Here’s what fits you best.',
    picks: ranked.slice(0, 3).map((e) => ({
      id: e.id,
      why:
        [
          liked(e) && `You like ${liked(e)}`,
          e.price === 0 && 'it’s free',
          e.openCrews && `${e.openCrews} crew${e.openCrews > 1 ? 's' : ''} you can join`,
          e.going && `${e.going} from Comoonly going`,
        ]
          .filter(Boolean)
          .join(' · ') || 'Something new to try',
    })),
  }
}
