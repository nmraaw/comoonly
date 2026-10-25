import nodemailer from 'nodemailer'
import { config } from './config.ts'

// Sends email from your Gmail (EMAIL_USER + EMAIL_APP_PASSWORD in .env, see .env.example).
// Without those, emails aren't sent: they're printed in the server log and kept in `outbox` (tests read it).
export const outbox: { to: string; subject: string; text: string }[] = []

const gmail = config.email.user && nodemailer.createTransport({ service: 'gmail', auth: config.email })

export async function sendEmail(to: string, subject: string, text: string) {
  if (!gmail) {
    outbox.push({ to, subject, text })
    console.log(`[email not set up] to ${to}: ${subject}\n${text}`)
    return
  }
  await gmail.sendMail({ from: `Comoonly <${config.email.user}>`, to, subject, text })
}
