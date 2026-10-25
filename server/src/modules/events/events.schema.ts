import { z } from 'zod'

const httpUrl = z.url({ protocol: /^https?$/, message: 'Use a full https:// link' })

// The fields of an event, without defaults (see eventPatchSchema for why).
const fields = {
  title: z.string().trim().min(1, 'Add a title').max(200),
  date: z
    .string()
    .trim()
    .refine((d) => !Number.isNaN(Date.parse(d)), 'Add a valid date'),
  city: z.string().trim().max(80),
  mode: z.enum(['In person', 'Online', 'Hybrid']),
  category: z.string().trim().min(1).max(40),
  description: z.string().trim().max(1000),
  registerUrl: httpUrl, // the official registration page
  deadline: z // last day to register, if the post says
    .string()
    .trim()
    .refine((d) => !d || !Number.isNaN(Date.parse(d)), 'Add a valid deadline'),
  sourceUrl: httpUrl, // where we found it
}

// One event, whether found by the finder or typed in by an admin. Anything that doesn't fit is thrown away.
export const eventSchema = z.object({
  ...fields,
  city: fields.city.default(''),
  mode: fields.mode.default('In person'),
  category: fields.category.default('Event'),
  description: fields.description.default(''),
  deadline: fields.deadline.default(''),
})

// Admin edits: change any field, then publish or reject. Built from `fields`, not eventSchema, on purpose:
// Zod fills in defaults even for left-out fields, so a "just publish it" edit would wipe city, category etc.
export const eventPatchSchema = z
  .object(fields)
  .partial()
  .extend({ status: z.enum(['draft', 'published', 'rejected']).optional() })

// A picture sent as a data URL. ~7 MB of text is a ~5 MB image.
const image = z
  .string()
  .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, 'Use a PNG, JPG or WebP image')
  .max(7_000_000, 'That image is too big; try a smaller one')

// "Suggest an event": the post's link, plus its caption and/or a screenshot of the poster.
export const suggestSchema = z
  .object({
    postUrl: httpUrl,
    text: z.string().trim().max(5000).default(''),
    image: image.optional(),
  })
  .refine((p) => p.text || p.image, { message: 'Paste the caption or add a screenshot', path: ['text'] })

// An admin adding or changing an event's poster.
export const posterSchema = z.object({ image })

// "I want to go": looking for company, happy to meet people there, or going with my own friends.
export const goSchema = z.object({ intent: z.enum(['company', 'meet', 'friends']) })

// Starting a crew. `plan` is where and when you'll meet, e.g. "Outside the main gate, 5:45".
export const crewSchema = z.object({
  size: z.coerce.number().int().min(2, 'A crew is 2 to 5 people').max(5, 'A crew is 2 to 5 people'),
  womenOnly: z.boolean().default(false),
  plan: z.string().trim().min(1, 'Say where and when you’ll meet').max(200),
  area: z.string().trim().max(80).default(''), // where you're coming from, e.g. "Gulshan"
})

export type Intent = z.infer<typeof goSchema>['intent']
export type CrewInput = z.infer<typeof crewSchema>
export type EventInput = z.infer<typeof eventSchema>
export type EventPatch = z.infer<typeof eventPatchSchema>
