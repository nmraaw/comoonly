import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../../middleware/auth.ts'
import { HttpError } from '../../middleware/errors.ts'
import { photoSchema, savePhoto, sendPhoto } from '../../photos.ts'
import { answerStillComing, imHere } from '../events/events.going.ts'
import {
  adoptSchema,
  areaSchema,
  comingSchema,
  createGroupSchema,
  expenseSchema,
  keepCrewSchema,
  listQuerySchema,
  pinnedSchema,
  projectStatusSchema,
} from './groups.schema.ts'
import {
  adoptionRequests,
  askToAdopt,
  decideAdoption,
  projectHistory,
  setProjectStatus,
  addExpense,
  announceGroup,
  createGroup,
  deleteExpense,
  deleteGroup,
  expenses,
  getGroup,
  keepCrew,
  listGroups,
  listMembers,
  savedGroupIds,
  setArea,
  setPinned,
  toggleSaved,
} from './groups.service.ts'

export const groupRoutes = Router()

// GET /api/groups?q=sketch&category=Creative&location=Sialkot&sort=spots
groupRoutes.get('/', (req, res) => {
  res.json(listGroups(listQuerySchema.parse(req.query)))
})

// Before '/:id', otherwise "saved" would be read as a group id.
groupRoutes.get('/saved', requireAuth, (req: any, res) => {
  res.json(savedGroupIds(req.user.id))
})

groupRoutes.post('/:id/save', requireAuth, (req: any, res) => {
  res.json(toggleSaved(req.user.id, req.params.id))
})

groupRoutes.get('/:id', (req, res) => {
  const group = getGroup(req.params.id)
  if (!group) throw new HttpError(404, 'Group not found')
  res.json(group)
})

groupRoutes.get('/:id/photo', (req, res) => {
  sendPhoto(res, 'group', req.params.id)
})

// The host adds or replaces the group's photo or poster.
groupRoutes.put('/:id/photo', requireAuth, (req: any, res) => {
  if (getGroup(req.params.id)?.ownerId !== req.user.id) throw new HttpError(403, 'Only the host can change the photo')
  savePhoto('group', req.params.id, photoSchema.parse(req.body).image)
  res.status(204).end()
})

groupRoutes.get('/:id/members', requireAuth, (req: any, res) => {
  res.json(listMembers(req.params.id, req.user.id))
})

// Browsing is public; creating needs an account so the group has a real owner.
groupRoutes.post('/', requireAuth, (req: any, res) => {
  const group = createGroup(req.user.id, createGroupSchema.parse(req.body))
  announceGroup(group) // here, not in createGroup: crews are made with it too, and aren't announced
  res.status(201).json(group)
})

groupRoutes.put('/:id/pinned', requireAuth, (req: any, res) => {
  setPinned(req.params.id, req.user.id, pinnedSchema.parse(req.body).pinned)
  res.status(204).end()
})

groupRoutes.post('/:id/keep', requireAuth, (req: any, res) => {
  res.json(keepCrew(req.params.id, req.user.id, keepCrewSchema.parse(req.body)))
})

groupRoutes.put('/:id/area', requireAuth, (req: any, res) => {
  setArea(req.params.id, req.user.id, areaSchema.parse(req.body).area)
  res.status(204).end()
})

groupRoutes.get('/:id/expenses', requireAuth, (req: any, res) => {
  res.json(expenses(req.params.id, req.user.id))
})

groupRoutes.post('/:id/expenses', requireAuth, (req: any, res) => {
  const { what, amount } = expenseSchema.parse(req.body)
  addExpense(req.params.id, req.user.id, what, amount)
  res.status(201).json(expenses(req.params.id, req.user.id))
})

groupRoutes.delete('/:id/expenses/:expenseId', requireAuth, (req: any, res) => {
  deleteExpense(req.params.id, req.user.id, req.params.expenseId)
  res.status(204).end()
})

// A crew on the event day: "Still coming?" and "I'm here".
groupRoutes.put('/:id/coming', requireAuth, (req: any, res) => {
  answerStillComing(req.params.id, req.user.id, comingSchema.parse(req.body).answer)
  res.status(204).end()
})

groupRoutes.post('/:id/here', requireAuth, (req: any, res) => {
  imHere(req.params.id, req.user.id)
  res.status(204).end()
})

// The Idea Graveyard: a project's story is public, like the project itself.
groupRoutes.get('/:id/history', (req, res) => {
  res.json(projectHistory(req.params.id))
})

groupRoutes.post('/:id/adopt', requireAuth, (req: any, res) => {
  res.json({ status: askToAdopt(req.params.id, req.user.id, adoptSchema.parse(req.body).note) })
})

groupRoutes.get('/:id/adoptions', requireAuth, (req: any, res) => {
  res.json(adoptionRequests(req.params.id, req.user.id))
})

groupRoutes.post('/:id/adoptions/:userId', requireAuth, (req: any, res) => {
  const accept = z.object({ decision: z.enum(['accept', 'decline']) }).parse(req.body).decision === 'accept'
  decideAdoption(req.params.id, req.user.id, req.params.userId, accept)
  res.status(204).end()
})

groupRoutes.put('/:id/project', requireAuth, (req: any, res) => {
  setProjectStatus(req.params.id, req.user.id, projectStatusSchema.parse(req.body).status)
  res.status(204).end()
})

groupRoutes.delete('/:id', requireAuth, (req: any, res) => {
  deleteGroup(req.params.id, req.user)
  res.status(204).end()
})
