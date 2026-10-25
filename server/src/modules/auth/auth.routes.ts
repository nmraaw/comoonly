import { Router } from 'express'
import { clearSessionCookie, requireAuth, setSessionCookie } from '../../middleware/auth.ts'
import { deleteAccountSchema, loginSchema, signupSchema, verifySchema } from './auth.schema.ts'
import { createSession, deleteAccount, endSession, login, signup, verify } from './auth.service.ts'

export const authRoutes = Router()

// Answers { needsCode: true } (the app then asks for the code that was just emailed), or the new user.
authRoutes.post('/signup', async (req, res) => {
  const result = await signup(signupSchema.parse(req.body))
  if ('needsCode' in result) return res.status(202).json(result)
  setSessionCookie(res, createSession(result.id))
  res.status(201).json(result)
})

authRoutes.post('/verify', (req, res) => {
  const user = verify(verifySchema.parse(req.body))
  setSessionCookie(res, createSession(user.id))
  res.status(201).json(user)
})

// A logged-in user, or { needsCode: true } for someone who never entered their sign-up code.
authRoutes.post('/login', async (req, res) => {
  const result = await login(loginSchema.parse(req.body))
  if ('needsCode' in result) return res.status(202).json(result)
  setSessionCookie(res, createSession(result.id))
  res.json(result)
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
