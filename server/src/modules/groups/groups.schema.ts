import { z } from 'zod'

// Same choices as the chips in the Create and Discover pages.
export const categories = ['Creative', 'Music', 'Tech', 'Film', 'Reading'] as const
export const modes = ['In person', 'Online', 'Hybrid'] as const

// Query-string values always arrive as text, hence z.coerce for the numbers.
export const listQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.enum(categories).optional(),
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
    category: z.enum(categories),
    mode: z.enum(modes),
    location: z.string().trim().max(80).default(''),
    spots: z.coerce.number().int().min(1).max(30), // "How many people are you looking for?"
  })
  .refine((g) => g.mode === 'Online' || g.location, {
    path: ['location'],
    message: 'Where will you meet?',
  })

export type ListQuery = z.infer<typeof listQuerySchema>
export type CreateGroupInput = z.infer<typeof createGroupSchema>
