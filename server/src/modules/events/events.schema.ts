import { z } from 'zod'

const httpUrl = z.url({ protocol: /^https?$/, message: 'Use a full https:// link' })

// One event, whether found by the finder or typed in by an admin. Anything that doesn't fit is thrown away.
export const eventSchema = z.object({
  title: z.string().trim().min(1, 'Add a title').max(200),
  date: z.string().trim().refine((d) => !Number.isNaN(Date.parse(d)), 'Add a valid date'),
  city: z.string().trim().max(80).default(''),
  mode: z.enum(['In person', 'Online', 'Hybrid']).default('In person'),
  category: z.string().trim().min(1).max(40).default('Event'),
  description: z.string().trim().max(1000).default(''),
  registerUrl: httpUrl, // the official registration page
  sourceUrl: httpUrl, // where we found it
})

// Admin edits in the review queue: change any field, then publish or reject.
export const eventPatchSchema = eventSchema.partial().extend({
  status: z.enum(['draft', 'published', 'rejected']).optional(),
})

export type EventInput = z.infer<typeof eventSchema>
export type EventPatch = z.infer<typeof eventPatchSchema>
