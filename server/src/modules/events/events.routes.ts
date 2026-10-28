import { Router } from 'express'
import { requireAdmin, requireAuth } from '../../middleware/auth.ts'
import { HttpError } from '../../middleware/errors.ts'
import {
  crewSchema,
  eventPatchSchema,
  eventSchema,
  goSchema,
  matchSchema,
  posterSchema,
  suggestSchema,
} from './events.schema.ts'
import {
  createCrew,
  findMeACrew,
  goTo,
  intentOf,
  intentsOf,
  listCrews,
  matchStatus,
  notGoing,
  stopMatching,
  whoIsGoing,
} from './events.going.ts'
import {
  deleteEvent,
  eventForGroup,
  getEvent,
  listDrafts,
  savePoster,
  listPublished,
  places,
  saveEvent,
  updateEvent,
} from './events.service.ts'
import { eventsFromPost } from './events.ai.ts'
import { scanSources } from './events.finder.ts'
import { findPost } from './events.instagram.ts'
import { sendIcs } from '../../calendar.ts'
import { sendPhoto } from '../../photos.ts'

export const eventRoutes = Router()

// The "Where" filter's choices. Before '/:id', so "places" isn't read as an event id.
eventRoutes.get('/places', requireAuth, (_req, res) => {
  res.json(places())
})

// Everyone (logged in): upcoming published events.
eventRoutes.get('/', requireAuth, (req: any, res) => {
  const mine = intentsOf(req.user.id)
  res.json(listPublished().map((e: any) => ({ ...e, myIntent: mine.get(e.id) ?? null })))
})

// "Find people to go with" → the event's group id, to open it.
// "I want to go" (or change how). Answers the everyone-going group's id, or null for "with my friends".
eventRoutes.post('/:id/go', requireAuth, (req: any, res) => {
  res.json({ groupId: goTo(req.params.id, req.user.id, goSchema.parse(req.body).intent) })
})

eventRoutes.delete('/:id/go', requireAuth, (req: any, res) => {
  notGoing(req.params.id, req.user.id)
  res.status(204).end()
})

eventRoutes.get('/:id/crews', requireAuth, (req: any, res) => {
  res.json(listCrews(req.params.id, req.user.id))
})

eventRoutes.post('/:id/crews', requireAuth, (req: any, res) => {
  res.status(201).json({ id: createCrew(req.params.id, req.user.id, crewSchema.parse(req.body)) })
})

// "Find me a crew": joins the best open crew (a request), forms a new one, or waits for more people.
eventRoutes.post('/:id/match', requireAuth, (req: any, res) => {
  res.json(findMeACrew(req.params.id, req.user.id, matchSchema.parse(req.body).womenOnly))
})

eventRoutes.get('/:id/going', requireAuth, (req: any, res) => {
  res.json(whoIsGoing(req.params.id, req.user.id))
})

eventRoutes.get('/:id/match', requireAuth, (req: any, res) => {
  res.json(matchStatus(req.params.id, req.user.id))
})

eventRoutes.delete('/:id/match', requireAuth, (req: any, res) => {
  stopMatching(req.params.id, req.user.id)
  res.status(204).end()
})

// The event an event group is for (its "Event" tab).
eventRoutes.get('/for-group/:groupId', requireAuth, (req, res) => {
  res.json(eventForGroup(req.params.groupId as string))
})

eventRoutes.get('/:id/poster', requireAuth, (req, res) => {
  sendPhoto(res, 'poster', req.params.id as string)
})

// "Add to calendar" (Apple, Outlook, phones).
eventRoutes.get('/:id/calendar.ics', requireAuth, (req, res) => {
  const e = getEvent(req.params.id as string)
  if (e.status !== 'published') throw new HttpError(404, 'Event not found')
  const place = e.mode === 'Online' ? 'Online' : e.city
  const register = e.registerUrl ? `\n\nRegister: ${e.registerUrl}` : ''
  sendIcs(res, { ...e, place, details: `${e.description}${register}`.trim() })
})

// "Suggest an event": anyone shares a post (Instagram, TikTok, a poster). The AI reads it; an admin approves.
// shortcut: the 10-a-day limit is counted in memory (resets on restart), move to the database with several servers.
const suggestions = new Map<string, { count: number; until: number }>()
eventRoutes.post('/suggest', requireAuth, async (req: any, res) => {
  const post = suggestSchema.parse(req.body)
  const now = Date.now()
  const used = suggestions.get(req.user.id)
  const current = used && used.until > now ? used : { count: 0, until: now + 86_400_000 }
  if (!req.user.isAdmin && current.count >= 10)
    throw new HttpError(429, 'That’s 10 suggestions today. Thank you! Try again tomorrow.')
  suggestions.set(req.user.id, { ...current, count: current.count + 1 })
  // Only an Instagram link: read the post itself through Instagram's API.
  const filled = post.text || post.image ? post : { ...post, ...(await findPost(post.postUrl, post.account)) }
  res.json(await eventsFromPost(filled, req.user.id))
})

// ----- Admin only: review queue. Nothing is published without a person approving it. -----

eventRoutes.get('/review', requireAuth, requireAdmin, (_req, res) => {
  res.json(listDrafts())
})

eventRoutes.post('/scan', requireAuth, requireAdmin, async (_req, res) => {
  res.json(await scanSources())
})

// An admin adding an event by hand publishes it straight away.
eventRoutes.post('/', requireAuth, requireAdmin, (req, res) => {
  const event = eventSchema.parse(req.body)
  const id = saveEvent(event, 'published')
  if (!id) return res.status(409).json({ error: 'This event is already listed' })
  res.status(201).json({ id })
})

// Add or replace the poster.
eventRoutes.put('/:id/poster', requireAuth, requireAdmin, (req, res) => {
  getEvent(req.params.id as string) // 404 if there's no such event
  savePoster(req.params.id as string, posterSchema.parse(req.body).image)
  res.status(204).end()
})

// Remove an event (and its group) for good, e.g. cancelled or posted by mistake.
eventRoutes.delete('/:id', requireAuth, requireAdmin, (req, res) => {
  deleteEvent(req.params.id as string)
  res.status(204).end()
})

// Edit fields, and/or publish or reject.
eventRoutes.patch('/:id', requireAuth, requireAdmin, (req, res) => {
  res.json(updateEvent(req.params.id, eventPatchSchema.parse(req.body)))
})

// One event's page. Last on purpose: '/:id' would otherwise catch '/review'.
eventRoutes.get('/:id', requireAuth, (req: any, res) => {
  const event = getEvent(req.params.id)
  if (event.status !== 'published') throw new HttpError(404, 'Event not found')
  res.json({ ...event, myIntent: intentOf(event.id, req.user.id) })
})
