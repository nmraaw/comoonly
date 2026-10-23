import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.ts'
import { reportSchema } from './safety.schema.ts'
import { block, report, unblock } from './safety.service.ts'

// Mounted at /api. Reports are read by admins on the dashboard (see modules/admin).
export const safetyRoutes = Router()

safetyRoutes.post('/users/:id/block', requireAuth, (req: any, res) => {
  block(req.user.id, req.params.id)
  res.status(204).end()
})

safetyRoutes.delete('/users/:id/block', requireAuth, (req: any, res) => {
  unblock(req.user.id, req.params.id)
  res.status(204).end()
})

safetyRoutes.post('/users/:id/report', requireAuth, (req: any, res) => {
  report(req.user.id, req.params.id, reportSchema.parse(req.body))
  res.status(201).end()
})
