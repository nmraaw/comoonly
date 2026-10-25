import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.ts'
import { HttpError } from '../../middleware/errors.ts'
import { sendIcs } from '../../calendar.ts'
import { activitySchema, taskSchema } from './workspace.schema.ts'
import {
  addActivity,
  addTask,
  getActivity,
  listActivities,
  listTasks,
  toggleGoing,
  toggleTask,
} from './workspace.service.ts'

// Mounted at /api. A group's shared plans (activities) and to-dos, for members only.
export const workspaceRoutes = Router()

workspaceRoutes.get('/groups/:id/activities', requireAuth, (req: any, res) => {
  res.json(listActivities(req.params.id, req.user.id))
})

workspaceRoutes.post('/groups/:id/activities', requireAuth, (req: any, res) => {
  res.status(201).json(addActivity(req.params.id, req.user.id, activitySchema.parse(req.body)))
})

workspaceRoutes.get('/activities/:id', requireAuth, (req: any, res) => {
  res.json(getActivity(req.params.id, req.user.id))
})

// "Add to calendar" for members (Apple, Outlook, phones).
workspaceRoutes.get('/activities/:id/calendar.ics', requireAuth, (req: any, res) => {
  const a: any = getActivity(req.params.id, req.user.id)
  if (a.locked) throw new HttpError(404, 'Activity not found')
  sendIcs(res, { ...a, details: [a.plan, a.notes].filter(Boolean).join('\n\n') })
})

workspaceRoutes.post('/activities/:id/going', requireAuth, (req: any, res) => {
  res.json(toggleGoing(req.params.id, req.user.id))
})

workspaceRoutes.get('/groups/:id/tasks', requireAuth, (req: any, res) => {
  res.json(listTasks(req.params.id, req.user.id))
})

workspaceRoutes.post('/groups/:id/tasks', requireAuth, (req: any, res) => {
  res.status(201).json(addTask(req.params.id, req.user.id, taskSchema.parse(req.body).title))
})

workspaceRoutes.post('/tasks/:id/toggle', requireAuth, (req: any, res) => {
  res.json(toggleTask(req.params.id, req.user.id))
})
