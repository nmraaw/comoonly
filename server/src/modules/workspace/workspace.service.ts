import { randomUUID } from 'node:crypto'
import { db } from '../../db/connection.ts'
import { HttpError } from '../../middleware/errors.ts'
import { isMember, requireMember } from '../groups/groups.service.ts'
import type { ActivityInput } from './workspace.schema.ts'

// `going` = whether the person asking has said "I'm going".
const ACTIVITY = `SELECT a.id, a.group_id AS groupId, a.title, a.starts_at AS date, a.place,
    (SELECT COUNT(*) FROM rsvps r WHERE r.activity_id = a.id) AS goingCount,
    EXISTS (SELECT 1 FROM rsvps r WHERE r.activity_id = a.id AND r.user_id = ?) AS going
  FROM activities a`

const toActivity = (row: any) => ({ ...row, going: Boolean(row.going) })

export function listActivities(groupId: string, userId: string) {
  requireMember(groupId, userId)
  return db.prepare(`${ACTIVITY} WHERE a.group_id = ? ORDER BY a.starts_at`).all(userId, groupId).map(toActivity)
}

// Non-members only learn which group it belongs to, so the page can offer "Request to join".
export function getActivity(id: string, userId: string) {
  const row: any = db.prepare(`${ACTIVITY} WHERE a.id = ?`).get(userId, id)
  if (!row) throw new HttpError(404, 'Activity not found')
  if (!isMember(row.groupId, userId)) return { id, groupId: row.groupId, locked: true }
  return toActivity(row)
}

export function addActivity(groupId: string, userId: string, input: ActivityInput) {
  requireMember(groupId, userId)
  const id = randomUUID()
  db.prepare(
    'INSERT INTO activities (id, group_id, title, starts_at, place, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(id, groupId, input.title, input.date, input.place, userId, Date.now())
  return getActivity(id, userId)
}

// Pressing "Join activity" again takes you off the list.
export function toggleGoing(activityId: string, userId: string) {
  const activity: any = getActivity(activityId, userId)
  requireMember(activity.groupId, userId)
  const removed = db.prepare('DELETE FROM rsvps WHERE activity_id = ? AND user_id = ?').run(activityId, userId)
  if (!removed.changes) db.prepare('INSERT INTO rsvps (activity_id, user_id) VALUES (?, ?)').run(activityId, userId)
  return getActivity(activityId, userId)
}

export function listTasks(groupId: string, userId: string) {
  requireMember(groupId, userId)
  return db
    .prepare('SELECT id, title, done FROM tasks WHERE group_id = ? ORDER BY created_at')
    .all(groupId)
    .map((t: any) => ({ ...t, done: Boolean(t.done) }))
}

export function addTask(groupId: string, userId: string, title: string) {
  requireMember(groupId, userId)
  db.prepare('INSERT INTO tasks (id, group_id, title, created_at) VALUES (?, ?, ?, ?)').run(
    randomUUID(),
    groupId,
    title,
    Date.now(),
  )
  return listTasks(groupId, userId)
}

export function toggleTask(taskId: string, userId: string) {
  const task: any = db.prepare('SELECT group_id FROM tasks WHERE id = ?').get(taskId)
  if (!task) throw new HttpError(404, 'Task not found')
  requireMember(task.group_id, userId)
  db.prepare('UPDATE tasks SET done = 1 - done WHERE id = ?').run(taskId)
  return listTasks(task.group_id, userId)
}
