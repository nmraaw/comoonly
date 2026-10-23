import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import { db } from '../../db/connection.ts'
import { config } from '../../config.ts'
import { HttpError } from '../../middleware/errors.ts'
import type { LoginInput, SignupInput } from './auth.schema.ts'

// Passwords are never stored. We keep "salt:hash"; the random salt makes equal passwords look different.
// shortcut: scryptSync blocks the server for ~50ms per login, fine at hackathon scale, use async scrypt for real traffic.
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`
}

function passwordMatches(password: string, stored: string) {
  const [salt, hash] = stored.split(':')
  const attempt = scryptSync(password, salt, 64)
  return timingSafeEqual(attempt, Buffer.from(hash, 'hex')) // constant-time compare
}

const PUBLIC_COLUMNS = 'id, name, email, city, tagline, bio, interests'

// The logged-in person as the frontend sees them. Also used by people.service after a profile edit.
// Lists exactly what goes out, so a new column (like password_hash) can never leak by accident.
export function toUser(row: any) {
  const { id, name, email, city, tagline, bio } = row
  return { id, name, email, city, tagline, bio, interests: JSON.parse(row.interests), isAdmin: config.adminEmails.includes(email) }
}

export function signup(input: SignupInput) {
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(input.email)) {
    throw new HttpError(409, 'That email is already registered')
  }
  const id = randomUUID()
  db.prepare(
    'INSERT INTO users (id, name, email, password_hash, city, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, input.name, input.email, hashPassword(input.password), input.city, Date.now())
  return toUser(db.prepare(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = ?`).get(id))
}

export function login({ email, password }: LoginInput) {
  const row: any = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
  // One message for both cases, so nobody can use the form to discover which emails exist.
  if (!row || !passwordMatches(password, row.password_hash)) {
    throw new HttpError(401, 'Wrong email or password')
  }
  return toUser(row)
}

export function createSession(userId: string) {
  const token = randomBytes(32).toString('hex')
  const expires = Date.now() + config.sessionDays * 86_400_000
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expires)
  return token
}

export function userForToken(token: string) {
  const row = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.city, u.tagline, u.bio, u.interests FROM sessions s
       JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ?`,
    )
    .get(token, Date.now())
  return row ? toUser(row) : undefined
}

export function endSession(token: string) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
}
