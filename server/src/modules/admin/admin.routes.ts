import { Router } from 'express'
import { requireAdmin, requireAuth } from '../../middleware/auth.ts'
import { rmSync } from 'node:fs'
import { dirname } from 'node:path'
import { backupFile, deleteUser, overview, resolveReport } from './admin.service.ts'

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

// Download a backup: the browser saves the file; the temporary copy is removed once it's sent.
adminRoutes.get('/backup', (_req, res) => {
  const file = backupFile()
  res.download(file, () => rmSync(dirname(file), { recursive: true, force: true }))
})

adminRoutes.delete('/users/:id', (req, res) => {
  deleteUser(req.params.id)
  res.status(204).end()
})
