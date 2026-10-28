import { z } from 'zod'
import { imageSchema, photoSchema } from '../../photos.ts'

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
  // The cheapest ticket in rupees: 0 = free, null = not stated. Forms and the AI may send text or "".
  price: z.preprocess(
    (v) => (v === '' || v === undefined || v === null ? null : Math.round(Number(String(v).replace(/[^\d.]/g, '')))),
    z.number().int().min(0).max(1_000_000).nullable(),
  ),
}

// One event, whether found by the finder or typed in by an admin. Anything that doesn't fit is thrown away.
export const eventSchema = z.object({
  ...fields,
  city: fields.city.default(''),
  mode: fields.mode.default('In person'),
  category: fields.category.default('Event'),
  description: fields.description.default(''),
  deadline: fields.deadline.default(''),
  price: fields.price.default(null),
})

// Admin edits: change any field, then publish or reject. Built from `fields`, not eventSchema, on purpose:
// Zod fills in defaults even for left-out fields, so a "just publish it" edit would wipe city, category etc.
export const eventPatchSchema = z
  .object(fields)
  .partial()
  .extend({ status: z.enum(['draft', 'published', 'rejected']).optional() })

// "Suggest an event": the post's link, plus its caption and/or a screenshot of the poster.
export const suggestSchema = z
  .object({
    postUrl: httpUrl,
    text: z.string().trim().max(5000).default(''),
    image: imageSchema.optional(),
    account: z.string().trim().max(31).default(''), // Instagram @name, for a link alone (see findPost)
  })
  .refine((p) => p.text || p.image || /instagram\.com\//i.test(p.postUrl), {
    message: 'For links outside Instagram, add a screenshot of the post or paste its caption',
    path: ['text'],
  })

// An admin adding or changing an event's poster.
export const posterSchema = photoSchema

// "I want to go": looking for company, happy to meet people there, or going with my own friends.
export const goSchema = z.object({ intent: z.enum(['company', 'meet', 'friends']) })

// Starting a crew. `plan` is where and when you'll meet, e.g. "Outside the main gate, 5:45".
export const crewSchema = z.object({
  size: z.coerce.number().int().min(2, 'A crew is 2 to 5 people').max(5, 'A crew is 2 to 5 people'),
  womenOnly: z.boolean().default(false),
  plan: z.string().trim().min(1, 'Say where and when you’ll meet').max(200),
  area: z.string().trim().max(80).default(''), // where you're coming from, e.g. "Gulshan"
})

// "Find me a crew": optionally only with other women.
export const matchSchema = z.object({ womenOnly: z.boolean().default(false) })

export type Intent = z.infer<typeof goSchema>['intent']
export type CrewInput = z.infer<typeof crewSchema>
export type EventInput = z.infer<typeof eventSchema>
export type EventPatch = z.infer<typeof eventPatchSchema>
