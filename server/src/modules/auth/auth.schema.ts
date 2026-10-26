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

// The 6-digit code from the sign-up email. The password comes along again (see auth.service verify).
export const verifySchema = loginSchema.extend({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'The code is 6 digits'),
})

// Deleting your account asks for your password again, so nobody can do it from a borrowed phone.
export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Enter your password').max(100),
})

export type SignupInput = z.infer<typeof signupSchema>
// Forgot password: the email asks for a code; then the code and a new password reset it.
export const forgotSchema = z.object({ email })
export const resetSchema = verifySchema.extend({ password: signupSchema.shape.password })

export type LoginInput = z.infer<typeof loginSchema>
export type VerifyInput = z.infer<typeof verifySchema>
