import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import DetailHeader from '../components/DetailHeader'
import { shrink } from '../images'
// Anyone can share an event they saw on Instagram, TikTok, WhatsApp or a poster. It goes live after a review.
export default function SuggestEvent() {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  async function submit(form: HTMLFormElement) {
    const data = new FormData(form)
    const file = data.get('image') as File
    setBusy(true)
    setNote('')
    try {
      const image = file?.size ? await shrink(file) : undefined
      const r = await api<{ found: number; added: number }>('/events/suggest', {
        method: 'POST',
        body: { postUrl: data.get('postUrl'), account: data.get('account'), text: data.get('text'), image },
      })
      if (r.added) {
        setDone(true)
        form.reset()
      } else
        setNote(
          r.found
            ? 'We already have this one. Thank you!'
            : 'We couldn’t find an upcoming event with open registration in that post. Try adding a screenshot of the poster.',
        )
    } catch (err) {
      setNote((err as Error).message)
    }
    setBusy(false)
  }
  if (done)
    return (
      <>
        <DetailHeader title="Suggest an event" fallback="/events" />
        <h1>Thank you!</h1>
        <p>We’ll check the details. Once it’s approved, it shows up on Events for everyone.</p>
        <button className="button primary" onClick={() => setDone(false)}>
          Suggest another
        </button>
        <Link className="button" to="/events">
          Back to events
        </Link>
      </>
    )
  return (
    <>
      <DetailHeader title="Suggest an event" fallback="/events" />
      <h1>
        Seen something
        <br />
        worth going to?
      </h1>
      <p>
        Share an event from Instagram, TikTok or anywhere else. For Instagram, the link and the account’s @name are
        enough. For other sites, add a screenshot of the post or paste its caption.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit(e.currentTarget)
        }}
      >
        <label>
          Link to the post
          <input name="postUrl" type="url" required placeholder="https://www.instagram.com/p/…" />
        </label>
        <label>
          Instagram account (if the link doesn’t show it)
          <input name="account" maxLength={31} placeholder="@organizer" autoCapitalize="none" />
        </label>
        <p className="hint">Works for business and creator accounts, like most brands, venues and organizers.</p>
        <label>
          Caption (optional for Instagram)
          <textarea name="text" maxLength={5000} placeholder="Paste the post’s text here" />
        </label>
        <label>
          Screenshot of the post (optional for Instagram)
          <input name="image" type="file" accept="image/png,image/jpeg,image/webp" />
        </label>
        {note && (
          <p className="notice pink" role="status">
            {note}
          </p>
        )}
        <button className="button primary" disabled={busy}>
          {busy ? 'Reading the post…' : 'Send suggestion →'}
        </button>
      </form>
    </>
  )
}
