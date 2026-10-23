import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.ts'
import { messageSchema } from './chat.schema.ts'
import { conversations, directMessages, groupMessages, sendDirect, sendToGroup } from './chat.service.ts'

// Mounted at /api. Group chat is for members; direct messages are for accepted connections.
export const chatRoutes = Router()

chatRoutes.get('/groups/:id/messages', requireAuth, (req: any, res) => {
  res.json(groupMessages(req.params.id, req.user.id))
})

chatRoutes.post('/groups/:id/messages', requireAuth, (req: any, res) => {
  res.status(201).json(sendToGroup(req.params.id, req.user.id, messageSchema.parse(req.body).text))
})

chatRoutes.get('/messages', requireAuth, (req: any, res) => {
  res.json(conversations(req.user.id))
})

chatRoutes.get('/messages/with/:userId', requireAuth, (req: any, res) => {
  res.json(directMessages(req.user.id, req.params.userId))
})

chatRoutes.post('/messages/with/:userId', requireAuth, (req: any, res) => {
  res.status(201).json(sendDirect(req.user.id, req.params.userId, messageSchema.parse(req.body).text))
})
