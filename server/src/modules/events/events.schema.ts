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

// "Add from a post": the post's link, plus its caption and/or a screenshot of the poster.
export const postSchema = z
  .object({
    postUrl: httpUrl,
    text: z.string().trim().max(5000).default(''),
    // A screenshot sent as a data URL. ~7 MB of text is a ~5 MB image.
    image: z
      .string()
      .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, 'Use a PNG, JPG or WebP screenshot')
      .max(7_000_000, 'That image is too big; try a smaller screenshot')
      .optional(),
  })
  .refine((p) => p.text || p.image, { message: 'Paste the caption or add a screenshot', path: ['text'] })

export type EventInput = z.infer<typeof eventSchema>
export type EventPatch = z.infer<typeof eventPatchSchema>
