import nodemailer from 'nodemailer'
import { config } from './config.ts'

// Sends email from your Gmail, one of two ways:
// - EMAIL_RELAY_URL + EMAIL_RELAY_SECRET: through the Apps Script in your Gmail (docs/GMAIL_RELAY.md), over
//   normal HTTPS. Needed on Render's free plan, which blocks email ports.
// - EMAIL_USER + EMAIL_APP_PASSWORD: straight to Gmail (works on your computer).
// With neither, emails aren't sent: they're printed in the server log and kept in `outbox` (tests read it).
export const outbox: { to: string; subject: string; text: string }[] = []

export const emailIsSetUp = () => Boolean(config.email.relayUrl || config.email.user)

const gmail =
  config.email.user &&
  nodemailer.createTransport({
    service: 'gmail',
    auth: { user: config.email.user, pass: config.email.pass },
  })

export async function sendEmail(to: string, subject: string, text: string) {
  if (config.email.relayUrl) {
    const res = await fetch(config.email.relayUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret: config.email.relaySecret, to, subject, text }),
      signal: AbortSignal.timeout(20_000),
    })
    const answer = (await res.text()).trim()
    if (answer !== 'ok') throw new Error(`Email relay answered: ${answer.slice(0, 100)}`)
    return
  }
  if (!gmail) {
    outbox.push({ to, subject, text })
    console.log(`[email not set up] to ${to}: ${subject}\n${text}`)
    return
  }
  await gmail.sendMail({ from: `Comoonly <${config.email.user}>`, to, subject, text })
}
