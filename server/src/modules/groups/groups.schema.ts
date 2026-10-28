import { z } from 'zod'

// A community's interest: one of the choices on profiles (src/interests.ts) or the organizer's own, like "Chess".
const interest = z.string().trim().min(1, 'Pick an interest').max(30, 'Keep the interest short')
export const modes = ['In person', 'Online', 'Hybrid'] as const

// Query-string values always arrive as text, hence z.coerce for the numbers.
export const listQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: interest.optional(),
  mode: z.enum(modes).optional(),
  location: z.string().trim().max(80).optional(),
  sort: z.enum(['newest', 'spots', 'popular']).default('newest'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export const createGroupSchema = z
  .object({
    name: z.string().trim().min(1).max(70),
    description: z.string().trim().min(1).max(400),
    category: interest,
    mode: z.enum(modes),
    location: z.string().trim().max(80).default(''),
    spots: z.coerce.number().int().min(1).max(30), // "How many people are you looking for?"
  })
  .refine((g) => g.mode === 'Online' || g.location, {
    path: ['location'],
    message: 'Where will you meet?',
  })

// The pinned plan at the top of a group's chat.
export const pinnedSchema = z.object({ pinned: z.string().trim().max(200) })

// "Same crew next time?": the organizer turns a crew into a lasting community.
export const keepCrewSchema = z.object({
  name: z.string().trim().min(1).max(70),
  category: interest,
})

// Getting there together: the area a member is coming from (never an exact address).
export const areaSchema = z.object({ area: z.string().trim().max(60) })

// A shared cost, split equally between the members.
export const expenseSchema = z.object({
  what: z.string().trim().min(1, 'Say what it was for').max(60),
  amount: z.coerce.number().int('Whole rupees only').min(1, 'Add an amount').max(1_000_000),
})

export type ListQuery = z.infer<typeof listQuerySchema>
export type CreateGroupInput = z.infer<typeof createGroupSchema>
