import { db } from '../../db/connection.ts'
import { HttpError } from '../../middleware/errors.ts'
import { findUser, requireVerified } from '../auth/auth.service.ts'
import { getGroup } from '../groups/groups.service.ts'
import { notify } from '../notifications/notifications.service.ts'
import { nameOf, SHOWED_UP } from '../people/people.service.ts'
import { isBlocked } from '../safety/safety.service.ts'
import type { Decision } from './requests.schema.ts'

function findGroup(groupId: string) {
  const group = getGroup(groupId)
  if (!group) throw new HttpError(404, 'Group not found')
  return group
}

function findHostedGroup(groupId: string, userId: string) {
  const group = findGroup(groupId)
  if (group.ownerId !== userId) throw new HttpError(403, 'Only the host can do this')
  return group
}

function statusOf(groupId: string, userId: string) {
  const row: any = db
    .prepare('SELECT status FROM group_members WHERE group_id = ? AND user_id = ?')
    .get(groupId, userId)
  return row?.status as 'pending' | 'joined' | 'declined' | undefined
}

// Which groups the logged-in person is in or waiting for, e.g. { "film-club": "pending" }.
export function myMemberships(userId: string) {
  const rows = db
    .prepare("SELECT group_id, status FROM group_members WHERE user_id = ? AND status IN ('pending', 'joined')")
    .all(userId)
  return Object.fromEntries(rows.map((r: any) => [r.group_id, r.status]))
}

export function requestToJoin(groupId: string, userId: string, intro: string) {
  const group = findGroup(groupId)
  const status = statusOf(groupId, userId)
  // A declined row stays, so the same person can't keep re-sending requests to the host.
  if (status === 'declined') throw new HttpError(409, 'The host has declined this request')
  if (status) return status // already waiting or already in: nothing to do
  if (group.spots === 0) throw new HttpError(409, 'This group is full')
  if (isBlocked(group.ownerId, userId)) throw new HttpError(403, 'You can’t join this group')
  if (group.crewFor) {
    // Crews meet strangers in person: verified profiles only, and women-only crews are for women.
    requireVerified(userId)
    if (group.womenOnly && findUser(userId).gender !== 'woman') throw new HttpError(403, 'This crew is for women only')
  }
  db.prepare("INSERT INTO group_members (group_id, user_id, status, intro) VALUES (?, ?, 'pending', ?)").run(
    groupId,
    userId,
    intro,
  )
  notify(group.ownerId, 'update', `${nameOf(userId)} asked to join ${group.name}`, `/groups/${groupId}?tab=Members`)
  return 'pending'
}

export function listRequests(groupId: string, hostId: string) {
  findHostedGroup(groupId, hostId)
  return db
    .prepare(
      `SELECT u.id, u.name, u.city, m.intro, ${SHOWED_UP} FROM group_members m JOIN users u ON u.id = m.user_id
       WHERE m.group_id = ? AND m.status = 'pending' ORDER BY m.rowid`,
    )
    .all(groupId)
}

export function decide(groupId: string, hostId: string, userId: string, decision: Decision) {
  const group = findHostedGroup(groupId, hostId)
  if (statusOf(groupId, userId) !== 'pending') throw new HttpError(404, 'Request not found')
  if (decision === 'accept' && group.spots === 0) throw new HttpError(409, 'This group is full')
  const status = decision === 'accept' ? 'joined' : 'declined'
  db.prepare('UPDATE group_members SET status = ? WHERE group_id = ? AND user_id = ?').run(status, groupId, userId)
  // Only good news is sent. Declined people learn it if they ask again (see requestToJoin).
  if (status === 'joined')
    notify(userId, 'update', `You’re in! ${group.name} accepted your request`, `/groups/${groupId}`)
  return status
}

// Leaving a group, or taking back a request that's still waiting. Hosts can't leave their own group.
export function leave(groupId: string, userId: string) {
  const group = findGroup(groupId)
  if (group.ownerId === userId) throw new HttpError(409, 'You host this group, so you can’t leave it')
  db.prepare("DELETE FROM group_members WHERE group_id = ? AND user_id = ? AND status IN ('pending', 'joined')").run(
    groupId,
    userId,
  )
}
