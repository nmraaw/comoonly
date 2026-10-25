import { Router } from 'express'
import { deletePhoto, photoSchema, savePhoto, sendPhoto } from '../../photos.ts'
import { requireAuth } from '../../middleware/auth.ts'
import { answerSchema, profileSchema } from './people.schema.ts'
import { answerConnection, getProfile, listConnections, requestConnection, updateProfile } from './people.service.ts'

// Mounted at /api. Every route needs a login: profiles are only visible inside the app.
export const peopleRoutes = Router()

// Save your own profile (first-time setup and later edits).
peopleRoutes.patch('/users/me', requireAuth, (req: any, res) => {
  res.json(updateProfile(req.user.id, profileSchema.parse(req.body)))
})

// Someone's profile page, with their groups and how you're connected.
// Your profile photo: add or replace, or remove it.
peopleRoutes.put('/users/me/photo', requireAuth, (req: any, res) => {
  savePhoto('user', req.user.id, photoSchema.parse(req.body).image)
  res.status(204).end()
})

peopleRoutes.delete('/users/me/photo', requireAuth, (req: any, res) => {
  deletePhoto('user', req.user.id)
  res.status(204).end()
})

peopleRoutes.get('/users/:id/photo', requireAuth, (req: any, res) => {
  sendPhoto(res, 'user', req.params.id)
})

peopleRoutes.get('/users/:id', requireAuth, (req: any, res) => {
  res.json(getProfile(req.params.id, req.user.id))
})

peopleRoutes.post('/users/:id/connect', requireAuth, (req: any, res) => {
  res.json({ status: requestConnection(req.user.id, req.params.id) })
})

peopleRoutes.get('/connections', requireAuth, (req: any, res) => {
  res.json(listConnections(req.user.id))
})

// Answer a connection request someone sent you.
peopleRoutes.post('/connections/:userId', requireAuth, (req: any, res) => {
  const { decision } = answerSchema.parse(req.body)
  res.json({ status: answerConnection(req.user.id, req.params.userId, decision) })
})
