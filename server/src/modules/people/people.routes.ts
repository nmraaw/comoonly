import { Router } from 'express'
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
