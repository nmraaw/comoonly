import { z } from 'zod'

export const messageSchema = z.object({
  text: z.string().trim().min(1, 'Write something first').max(1000, 'Keep messages under 1000 characters'),
})
