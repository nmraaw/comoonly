import { z } from 'zod'

// The messages here are shown to people in the sign-up form.
const email = z.email('That email doesn’t look right').transform((e) => e.toLowerCase())

export const signupSchema = z.object({
  name: z.string().trim().min(1, 'Add your name').max(60),
  email,
  password: z.string().min(8, 'Use at least 8 characters for your password').max(100),
  city: z.string().trim().max(80).default(''),
})

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(100),
})

export type SignupInput = z.infer<typeof signupSchema>
export type LoginInput = z.infer<typeof loginSchema>
