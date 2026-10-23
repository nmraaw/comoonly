import { Router } from 'express'
import { requireAdmin, requireAuth } from '../../middleware/auth.ts'
import { overview, resolveReport } from './admin.service.ts'

// Mounted at /api/admin. Only emails in ADMIN_EMAILS get past these two checks; everyone else gets 401/403.
export const adminRoutes = Router()
adminRoutes.use(requireAuth, requireAdmin)

adminRoutes.get('/overview', (_req, res) => {
  res.json(overview())
})

adminRoutes.post('/reports/:id/resolve', (req, res) => {
  resolveReport(req.params.id)
  res.status(204).end()
})
