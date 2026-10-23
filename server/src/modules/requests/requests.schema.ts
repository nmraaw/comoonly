import { z } from 'zod'

// The "Say a little hello" form on a group's page.
export const joinSchema = z.object({
  intro: z.string().trim().min(1, 'Say a little hello first').max(300, 'Keep your hello under 300 characters'),
})

// The host's answer to one request.
export const decisionSchema = z.object({
  decision: z.enum(['accept', 'decline']),
})

export type Decision = z.infer<typeof decisionSchema>['decision']
