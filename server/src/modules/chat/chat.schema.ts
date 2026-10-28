import { z } from 'zod'

export const messageSchema = z.object({
  text: z.string().trim().min(1, 'Write something first').max(1000, 'Keep messages under 1000 characters'),
})

// A poll in a group chat: a question and 2-4 choices.
export const pollSchema = z.object({
  question: z.string().trim().min(1, 'Ask a question first').max(200),
  options: z.array(z.string().trim().min(1).max(60)).min(2, 'Add at least 2 choices').max(4),
})

export const voteSchema = z.object({ choice: z.number().int().min(0).max(3) })
