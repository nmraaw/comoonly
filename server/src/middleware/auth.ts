import { config } from '../config.ts'
import { userForToken } from '../modules/auth/auth.service.ts'
import { HttpError } from './errors.ts'

const COOKIE = 'sid'

function readToken(header: string | undefined) {
  // Tiny cookie parser so we don't need another package.
  return header?.match(new RegExp(`(?:^|; )${COOKIE}=([^;]+)`))?.[1]
}

// Runs on every request: if the browser sent a valid session cookie, req.user is the logged-in person.
export function loadUser(req: any, _res: any, next: any) {
  req.token = readToken(req.headers.cookie)
  req.user = req.token ? userForToken(req.token) : undefined
  next()
}

export function requireAuth(req: any, _res: any, next: any) {
  if (!req.user) throw new HttpError(401, 'Please log in')
  next()
}

export function requireAdmin(req: any, _res: any, next: any) {
  if (!req.user?.isAdmin) throw new HttpError(403, 'Only admins can do this')
  next()
}

// HttpOnly = page scripts can't read it; SameSite=Lax = other sites can't make the browser send it on POSTs.
export function setSessionCookie(res: any, token: string) {
  const maxAge = config.sessionDays * 86_400
  const secure = config.isProd ? '; Secure' : ''
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`)
}

export function clearSessionCookie(res: any) {
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`)
}
