import { createHash, randomBytes, randomInt, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import { db, transaction } from '../../db/connection.ts'
import { config } from '../../config.ts'
import { HttpError } from '../../middleware/errors.ts'
import { sendEmail } from '../../email.ts'
import type { LoginInput, SignupInput, VerifyInput } from './auth.schema.ts'

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

// Interests live in their own table (user_interests); this reads them back as one JSON list,
// in the order the person picked them. `u` is the users table's alias in the surrounding query.
export const INTERESTS = `(SELECT json_group_array(interest) FROM
  (SELECT interest FROM user_interests WHERE user_id = u.id ORDER BY position)) AS interests`
const USER = `u.id, u.name, u.email, u.city, u.tagline, u.bio, u.gender, ${INTERESTS}`

export function findUser(id: string) {
  return toUser(db.prepare(`SELECT ${USER} FROM users u WHERE u.id = ?`).get(id))
}

// The logged-in person as the frontend sees them. Also used by people.service after a profile edit.
// Lists exactly what goes out, so a new column (like password_hash) can never leak by accident.
export function toUser(row: any) {
  const { id, name, email, city, tagline, bio, gender } = row
  const interests = JSON.parse(row.interests)
  return {
    id,
    name,
    email,
    city,
    tagline,
    bio,
    gender,
    interests,
    verified: isVerified({ ...row, interests }),
    isAdmin: config.adminEmails.includes(email),
  }
}

// A verified profile: email confirmed at sign-up (every account that can log in) and the profile filled in:
// city, gender, a line about yourself and interests. Needed to start or join a crew.
export function isVerified(u: { city: string; gender: string; tagline: string; bio: string; interests: string[] }) {
  return Boolean(u.city && u.gender && (u.tagline || u.bio) && u.interests.length)
}

export function requireVerified(userId: string) {
  if (!findUser(userId).verified)
    throw new HttpError(403, 'Finish your profile first (city, gender, a line about you, interests) to join crews')
}

// Sign-up doesn't log you in: it emails a 6-digit code, and entering it (verify) does.
// An unverified account is only a claim, so signing up again with its email takes it over:
// a stranger can't block the real owner, and only the owner can ever finish it.
export async function signup(input: SignupInput) {
  const existing: any = db.prepare('SELECT id, verified FROM users WHERE email = ?').get(input.email)
  if (existing?.verified) throw new HttpError(409, 'That email is already registered')
  const id = existing?.id ?? randomUUID()
  if (existing) {
    db.prepare('UPDATE users SET name = ?, password_hash = ?, city = ? WHERE id = ?').run(
      input.name,
      hashPassword(input.password),
      input.city,
      id,
    )
  } else {
    db.prepare('INSERT INTO users (id, name, email, password_hash, city, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      id,
      input.name,
      input.email,
      hashPassword(input.password),
      input.city,
      Date.now(),
    )
  }
  if (!needsCode(input.email)) {
    db.prepare('UPDATE users SET verified = 1 WHERE id = ?').run(id)
    return findUser(id)
  }
  await sendCode(id, input.email)
  return { needsCode: true as const }
}

// Until Gmail is set up (.env EMAIL_USER), codes can't reach people, so only admin emails need one
// (read it in the server log): that still stops anyone claiming an admin's email.
// shortcut: anyone can sign up as anyone else's (non-admin) email meanwhile; set up email before launch.
const needsCode = (email: string) => Boolean(config.email.user) || config.adminEmails.includes(email)

const sha256 = (code: string) => createHash('sha256').update(code).digest('hex')

// At most one email a minute per person, so nobody can flood someone's inbox through our sign-up form.
async function sendCode(userId: string, email: string) {
  const now = Date.now()
  const last: any = db.prepare('SELECT created_at FROM email_codes WHERE user_id = ?').get(userId)
  if (last && now - last.created_at < 60_000) return
  const code = String(randomInt(1_000_000)).padStart(6, '0')
  db.prepare(
    `INSERT INTO email_codes (user_id, code_hash, created_at, expires_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (user_id) DO UPDATE SET code_hash = excluded.code_hash, tries = 0,
       created_at = excluded.created_at, expires_at = excluded.expires_at`,
  ).run(userId, sha256(code), now, now + 15 * 60_000)
  await sendEmail(
    email,
    `${code} is your Comoonly code`,
    `Your Comoonly code is ${code}\n\nIt works for 15 minutes. If you didn't sign up, ignore this email.`,
  )
}

// The code proves the email is theirs. Their password is saved again too, in case someone else
// signed up with this email in between (see signup).
export function verify({ email, password, code }: VerifyInput) {
  const row: any = db
    .prepare(
      'SELECT u.id, c.code_hash, c.tries, c.expires_at FROM users u JOIN email_codes c ON c.user_id = u.id WHERE u.email = ?',
    )
    .get(email)
  if (!row || row.expires_at < Date.now() || row.tries >= 5) {
    throw new HttpError(400, 'That code has expired. Tap “Send a new code”.')
  }
  if (row.code_hash !== sha256(code)) {
    db.prepare('UPDATE email_codes SET tries = tries + 1 WHERE user_id = ?').run(row.id)
    throw new HttpError(400, 'That code isn’t right. Check the email and try again.')
  }
  transaction(() => {
    db.prepare('UPDATE users SET verified = 1, password_hash = ? WHERE id = ?').run(hashPassword(password), row.id)
    db.prepare('DELETE FROM email_codes WHERE user_id = ?').run(row.id)
  })
  return findUser(row.id)
}

// After 10 wrong passwords for one email, that email must wait 15 minutes: stops password guessing.
// shortcut: counted in memory (resets on restart, one server only), move to the database if you run several servers.
const failures = new Map<string, { count: number; until: number }>()

export async function login({ email, password }: LoginInput) {
  const now = Date.now()
  const tries = failures.get(email)
  if (tries && tries.until > now && tries.count >= 10) {
    throw new HttpError(429, 'Too many tries. Wait 15 minutes, then try again.')
  }
  const row: any = db.prepare(`SELECT u.password_hash, u.verified, ${USER} FROM users u WHERE u.email = ?`).get(email)
  // One message for both cases, so the login form doesn't confirm which emails exist.
  if (!row || !passwordMatches(password, row.password_hash)) {
    const current = tries && tries.until > now ? tries : { count: 0, until: now + 15 * 60_000 }
    failures.set(email, { ...current, count: current.count + 1 })
    // Forget finished lockouts, so someone trying thousands of made-up emails can't fill the server's memory.
    if (failures.size > 10_000) for (const [key, value] of failures) if (value.until < now) failures.delete(key)
    throw new HttpError(401, 'Wrong email or password')
  }
  failures.delete(email)
  // Signed up but never entered the code: send a fresh one instead of logging in.
  if (!row.verified) {
    if (needsCode(email)) {
      await sendCode(row.id, email)
      return { needsCode: true as const }
    }
    db.prepare('UPDATE users SET verified = 1 WHERE id = ?').run(row.id) // stuck before email was optional
  }
  return toUser(row)
}

export function createSession(userId: string) {
  const token = randomBytes(32).toString('hex')
  const expires = Date.now() + config.sessionDays * 86_400_000
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now()) // tidy up old logins as we go
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expires)
  return token
}

export function userForToken(token: string) {
  const row = db
    .prepare(
      `SELECT ${USER} FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ?`,
    )
    .get(token, Date.now())
  return row ? toUser(row) : undefined
}

export function endSession(token: string) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
}

// Deletes the person and, through the database's ON DELETE rules, everything that only makes sense with
// them: profile, interests, sessions, messages, memberships, groups they host. Events they suggested stay.
export function deleteAccount(userId: string, password: string) {
  const row: any = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId)
  if (!row || !passwordMatches(password, row.password_hash)) throw new HttpError(401, 'That password isn’t right')
  db.prepare('DELETE FROM users WHERE id = ?').run(userId)
}
