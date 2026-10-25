import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.ts'
import { messageSchema } from './chat.schema.ts'
import {
  conversations,
  directMessages,
  groupMessages,
  requireCanHear,
  sendDirect,
  sendToGroup,
  VOICE_TEXT,
} from './chat.service.ts'
import { savePhoto, sendPhoto, voiceSchema } from '../../photos.ts'

// Mounted at /api. Group chat is for members; anyone can message anyone (see sendDirect for requests).
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

// Voice messages: sent like a text ("🎤 Voice message"), with the recording kept beside it.
chatRoutes.post('/groups/:id/messages/voice', requireAuth, (req: any, res) => {
  const { audio } = voiceSchema.parse(req.body)
  const message: any = sendToGroup(req.params.id, req.user.id, VOICE_TEXT)
  savePhoto('voice', message.id, audio)
  res.status(201).json({ ...message, voice: 1 })
})

chatRoutes.post('/messages/with/:userId/voice', requireAuth, (req: any, res) => {
  const { audio } = voiceSchema.parse(req.body)
  const message: any = sendDirect(req.user.id, req.params.userId, VOICE_TEXT)
  savePhoto('voice', message.id, audio)
  res.status(201).json({ ...message, voice: 1 })
})

chatRoutes.get('/voice/:messageId', requireAuth, (req: any, res) => {
  requireCanHear(req.params.messageId, req.user.id)
  sendPhoto(res, 'voice', req.params.messageId)
})
