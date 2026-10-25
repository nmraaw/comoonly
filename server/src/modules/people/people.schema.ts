import { z } from 'zod'

// An Instagram or TikTok username. People paste "@sara", "sara" or a whole profile link: keep just "sara".
const handle = z
  .string()
  .trim()
  .transform((h) =>
    h
      .replace(/^.*(instagram\.com|tiktok\.com)\/@?/i, '')
      .replace(/^@/, '')
      .replace(/[/?#].*$/, ''),
  )
  .pipe(z.string().regex(/^[A-Za-z0-9._]{0,30}$/, 'Just the username, e.g. sara.draws'))
  .default('')

// The "create your profile" / "edit profile" form.
export const profileSchema = z.object({
  name: z.string().trim().min(1, 'Add your name').max(60),
  city: z.string().trim().max(80).default(''),
  tagline: z.string().trim().max(80).default(''),
  bio: z.string().trim().max(400, 'Keep your bio under 400 characters').default(''),
  // '' = not said. Only "woman" can join women-only crews.
  gender: z.enum(['', 'woman', 'man', 'private']).default(''),
  instagram: handle,
  tiktok: handle,
  interests: z
    .array(z.string().trim().min(1).max(30))
    .min(1, 'Pick at least one interest')
    .max(12, 'Pick up to 12 interests'),
})

// Your answer to a connection request.
export const answerSchema = z.object({
  decision: z.enum(['accept', 'decline']),
})

export type ProfileInput = z.infer<typeof profileSchema>
