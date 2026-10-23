import { Router } from 'express'
import { clearSessionCookie, requireAuth, setSessionCookie } from '../../middleware/auth.ts'
import { deleteAccountSchema, loginSchema, signupSchema } from './auth.schema.ts'
import { createSession, deleteAccount, endSession, login, signup } from './auth.service.ts'

export const authRoutes = Router()

authRoutes.post('/signup', (req, res) => {
  const user = signup(signupSchema.parse(req.body))
  setSessionCookie(res, createSession(user.id))
  res.status(201).json(user)
})

authRoutes.post('/login', (req, res) => {
  const user = login(loginSchema.parse(req.body))
  setSessionCookie(res, createSession(user.id))
  res.json(user)
})

authRoutes.post('/logout', (req: any, res) => {
  if (req.token) endSession(req.token)
  clearSessionCookie(res)
  res.status(204).end()
})

// The frontend calls this on page load to learn who (if anyone) is logged in.
authRoutes.get('/me', requireAuth, (req: any, res) => {
  res.json(req.user)
})

// "Delete my account" on the Me tab. Everything about the person is removed; there's no undo.
authRoutes.delete('/me', requireAuth, (req: any, res) => {
  deleteAccount(req.user.id, deleteAccountSchema.parse(req.body).password)
  clearSessionCookie(res)
  res.status(204).end()
})
