import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { db } from '../../db/connection.ts'
import { HttpError } from '../../middleware/errors.ts'

const count = (sql: string, ...params: number[]) => (db.prepare(sql).get(...params) as any).n as number

// Everything on the admin dashboard in one go.
// shortcut: shows the newest 500 people/events and 200 reports, add paging when you pass that.
export function overview() {
  const weekAgo = Date.now() - 7 * 86_400_000
  return {
    totals: {
      people: count('SELECT COUNT(*) AS n FROM users'),
      newThisWeek: count('SELECT COUNT(*) AS n FROM users WHERE created_at > ?', weekAgo),
      groups: count('SELECT COUNT(*) AS n FROM groups'),
      published: count("SELECT COUNT(*) AS n FROM events WHERE status = 'published'"),
      drafts: count("SELECT COUNT(*) AS n FROM events WHERE status = 'draft'"),
      openReports: count("SELECT COUNT(*) AS n FROM reports WHERE status = 'open'"),
    },
    people: db
      .prepare(
        `SELECT u.id, u.name, u.email, u.city, u.created_at AS joinedAt,
           (SELECT COUNT(*) FROM group_members m WHERE m.user_id = u.id AND m.status = 'joined') AS groups
         FROM users u ORDER BY u.created_at DESC LIMIT 500`,
      )
      .all(),
    events: db
      .prepare(
        `SELECT e.id, e.title, e.starts_at AS date, e.city, e.status, e.register_url AS registerUrl,
           (SELECT COUNT(*) FROM group_members m WHERE m.group_id = e.group_id AND m.status = 'joined') AS going
         FROM events e ORDER BY e.created_at DESC LIMIT 500`,
      )
      .all(),
    reports: db
      .prepare(
        `SELECT r.id, r.reason, r.details, r.status, r.created_at AS createdAt,
           r.reported_id AS reportedId, reported.name AS reportedName, reporter.name AS reporterName
         FROM reports r JOIN users reported ON reported.id = r.reported_id JOIN users reporter ON reporter.id = r.reporter_id
         ORDER BY r.status = 'resolved', r.created_at DESC LIMIT 200`,
      )
      .all(),
  }
}

// For "please delete my data" emails (see the privacy page). Same effect as the person deleting it themselves.
export function deleteUser(id: string) {
  if (!db.prepare('DELETE FROM users WHERE id = ?').run(id).changes) throw new HttpError(404, 'Person not found')
}

export function resolveReport(id: string) {
  if (!db.prepare("UPDATE reports SET status = 'resolved' WHERE id = ?").run(id).changes) {
    throw new HttpError(404, 'Report not found')
  }
}

// A complete, consistent copy of the database as one file (SQLite's VACUUM INTO), for the dashboard's
// "Download a backup" button. It holds everyone's data, so only admins can get it (see admin.routes.ts).
export function backupFile() {
  const file = join(mkdtempSync(join(tmpdir(), 'comoonly-')), `comoonly-${new Date().toISOString().slice(0, 10)}.db`)
  db.prepare('VACUUM INTO ?').run(file)
  return file
}
