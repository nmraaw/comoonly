import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.ts'
import { HttpError } from '../../middleware/errors.ts'
import { photoSchema, savePhoto, sendPhoto } from '../../photos.ts'
import { createGroupSchema, listQuerySchema } from './groups.schema.ts'
import { createGroup, getGroup, listGroups, listMembers, savedGroupIds, toggleSaved } from './groups.service.ts'

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
  res.status(201).json(createGroup(req.user.id, createGroupSchema.parse(req.body)))
})
