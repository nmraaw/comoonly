import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.ts'
import { listNotifications, markRead, unreadCounts } from './notifications.service.ts'

// Mounted at /api/notifications. Only about the logged-in person, so there's no input to validate.
export const notificationRoutes = Router()

notificationRoutes.get('/', requireAuth, (req: any, res) => {
  res.json(listNotifications(req.user.id))
})

// The app asks this every few seconds to show the little badges.
notificationRoutes.get('/unread', requireAuth, (req: any, res) => {
  res.json(unreadCounts(req.user.id))
})

notificationRoutes.post('/read', requireAuth, (req: any, res) => {
  markRead(req.user.id)
  res.status(204).end()
})
