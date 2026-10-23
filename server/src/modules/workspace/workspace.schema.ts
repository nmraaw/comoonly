import { z } from 'zod'

export const activitySchema = z.object({
  title: z.string().trim().min(1, 'Name your plan').max(100),
  // From <input type="datetime-local">, e.g. 2026-10-25T16:00. Kept as typed: it's local time for the group.
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Pick a date and time'),
  place: z.string().trim().min(1, 'Where will you meet?').max(120),
})

export const taskSchema = z.object({
  title: z.string().trim().min(1, 'What needs doing?').max(100),
})

export type ActivityInput = z.infer<typeof activitySchema>
