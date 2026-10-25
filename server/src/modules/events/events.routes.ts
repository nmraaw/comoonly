import { Router } from 'express'
import { requireAdmin, requireAuth } from '../../middleware/auth.ts'
import { HttpError } from '../../middleware/errors.ts'
import { eventPatchSchema, eventSchema, posterSchema, suggestSchema } from './events.schema.ts'
import {
  deleteEvent,
  eventForGroup,
  getEvent,
  getPoster,
  goWith,
  listDrafts,
  savePoster,
  listPublished,
  saveEvent,
  updateEvent,
} from './events.service.ts'
import { eventsFromPost } from './events.ai.ts'
import { scanSources } from './events.finder.ts'
import { sendIcs } from '../../calendar.ts'

export const eventRoutes = Router()

// Everyone (logged in): upcoming published events.
eventRoutes.get('/', requireAuth, (_req, res) => {
  res.json(listPublished())
})

// "Find people to go with" → the event's group id, to open it.
eventRoutes.post('/:id/go', requireAuth, (req: any, res) => {
  res.json({ groupId: goWith(req.params.id, req.user.id) })
})

// The event an event group is for (its "Event" tab).
eventRoutes.get('/for-group/:groupId', requireAuth, (req, res) => {
  res.json(eventForGroup(req.params.groupId as string))
})

eventRoutes.get('/:id/poster', requireAuth, (req, res) => {
  const poster = getPoster(req.params.id as string)
  if (!poster) throw new HttpError(404, 'No poster')
  res.type(poster.mime).set('cache-control', 'private, max-age=86400').send(Buffer.from(poster.bytes))
})

// "Add to calendar" (Apple, Outlook, phones).
eventRoutes.get('/:id/calendar.ics', requireAuth, (req, res) => {
  const e = getEvent(req.params.id as string)
  if (e.status !== 'published') throw new HttpError(404, 'Event not found')
  const place = e.mode === 'Online' ? 'Online' : e.city
  sendIcs(res, { ...e, place, details: `${e.description}\n\nRegister: ${e.registerUrl}`.trim() })
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
  res.json(await eventsFromPost(post, req.user.id))
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
