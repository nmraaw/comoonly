import { z } from 'zod'

export const REASONS = [
  'Harassment',
  'Spam or scam',
  'Fake profile',
  'Felt unsafe at a meetup',
  'Something else',
] as const

export const reportSchema = z.object({
  reason: z.enum(REASONS, 'Pick a reason'),
  details: z.string().trim().max(1000, 'Keep it under 1000 characters').default(''),
})

export type ReportInput = z.infer<typeof reportSchema>
