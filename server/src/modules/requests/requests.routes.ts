import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.ts'
import { decisionSchema, joinSchema } from './requests.schema.ts'
import { decide, listRequests, myMemberships, requestToJoin } from './requests.service.ts'

// Mounted at /api/groups, before the groups routes, so /memberships isn't read as a group id.
// requireAuth sits on each route (not router.use) so the public group feed stays public.
export const requestRoutes = Router()

requestRoutes.get('/memberships', requireAuth, (req: any, res) => {
  res.json(myMemberships(req.user.id))
})

requestRoutes.post('/:id/requests', requireAuth, (req: any, res) => {
  const { intro } = joinSchema.parse(req.body)
  res.status(201).json({ status: requestToJoin(req.params.id, req.user.id, intro) })
})

// Host only: who is waiting to join.
requestRoutes.get('/:id/requests', requireAuth, (req: any, res) => {
  res.json(listRequests(req.params.id, req.user.id))
})

requestRoutes.post('/:id/requests/:userId', requireAuth, (req: any, res) => {
  const { decision } = decisionSchema.parse(req.body)
  res.json({ status: decide(req.params.id, req.user.id, req.params.userId, decision) })
})
