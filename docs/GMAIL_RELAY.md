# Sending email from Gmail on Render (the relay)

Render's free plan blocks email ports, so the app can't log in to Gmail directly there. Instead, a tiny
**Google Apps Script** in your Gmail sends each email. The app calls it over normal https with a secret.
Free, up to ~100 emails a day, sent from your real Gmail address (so they don't land in spam).

## The script

The ready-to-paste version, with your secret filled in, is `gmail-relay.gs.local` in the project folder
(never uploaded to GitHub). This is the same code with a placeholder:

```js
// Comoonly email relay: the app (on Render) asks this script to send an email from this Gmail.
const SECRET = 'PASTE-THE-SECRET-HERE'

function doPost(e) {
  const m = JSON.parse(e.postData.contents)
  if (m.secret !== SECRET) return ContentService.createTextOutput('wrong secret')
  MailApp.sendEmail({ to: m.to, subject: m.subject, body: m.text, name: 'Comoonly' })
  return ContentService.createTextOutput('ok')
}

// Run once from the editor: Google asks permission to send mail, and you get a test email.
function testSend() {
  MailApp.sendEmail(Session.getActiveUser().getEmail(), 'Comoonly relay works', 'The relay can send email.')
}
```

## Setting it up (5 minutes)
1. Sign in to the Gmail that should send the codes, open **script.google.com** → **New project**.
2. Delete what's there, paste the whole of `gmail-relay.gs.local`, press **Save** (name it "Comoonly email").
3. Pick **testSend** in the function list at the top → **Run** → **Review permissions** → choose the account →
   if it says "Google hasn't verified this app": **Advanced** → **Go to Comoonly email (unsafe)** (it's your own
   script) → **Allow**. A "Comoonly relay works" email should arrive.
4. **Deploy** → **New deployment** → gear ⚙ → **Web app**. *Execute as:* **Me**. *Who has access:* **Anyone**.
   → **Deploy** → copy the **Web app URL** (`https://script.google.com/macros/s/…/exec`).
5. In Render → your service → **Environment** → add `EMAIL_RELAY_URL` = that URL and `EMAIL_RELAY_SECRET` =
   the secret from `gmail-relay.gs.local` → **Save, rebuild, and deploy**.

"Anyone" can reach the address, but without the secret the script refuses to send.
If you ever change the script, use **Deploy → Manage deployments → Edit → New version** so the URL stays the same.
