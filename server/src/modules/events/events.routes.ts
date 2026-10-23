import { Router } from 'express'
import { requireAdmin, requireAuth } from '../../middleware/auth.ts'
import { eventPatchSchema, eventSchema, postSchema } from './events.schema.ts'
import { goWith, listDrafts, listPublished, saveEvent, updateEvent } from './events.service.ts'
import { eventsFromPost, scanSources } from './events.finder.ts'

export const eventRoutes = Router()

// Everyone (logged in): upcoming published events.
eventRoutes.get('/', requireAuth, (_req, res) => {
  res.json(listPublished())
})

// "Find people to go with" → the event's group id, to open it.
eventRoutes.post('/:id/go', requireAuth, (req: any, res) => {
  res.json({ groupId: goWith(req.params.id, req.user.id) })
})

// ----- Admin only: review queue. Nothing is published without a person approving it. -----

eventRoutes.get('/review', requireAuth, requireAdmin, (_req, res) => {
  res.json(listDrafts())
})

eventRoutes.post('/scan', requireAuth, requireAdmin, async (_req, res) => {
  res.json(await scanSources())
})

// Instagram/TikTok: the AI reads a pasted caption or poster screenshot; results wait in the review queue.
eventRoutes.post('/from-post', requireAuth, requireAdmin, async (req, res) => {
  res.json(await eventsFromPost(postSchema.parse(req.body)))
})

// An admin adding an event by hand publishes it straight away.
eventRoutes.post('/', requireAuth, requireAdmin, (req, res) => {
  const event = eventSchema.parse(req.body)
  if (!saveEvent(event, 'published')) return res.status(409).json({ error: 'This event is already listed' })
  res.status(201).end()
})

// Edit fields, and/or publish or reject.
eventRoutes.patch('/:id', requireAuth, requireAdmin, (req, res) => {
  res.json(updateEvent(req.params.id, eventPatchSchema.parse(req.body)))
})
