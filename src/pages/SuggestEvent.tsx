import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import DetailHeader from '../components/DetailHeader'
// Phone screenshots are large; scale to at most 1600px and save as JPEG before sending (still sharp enough to read).
async function shrink(file: File) {
  const img = await createImageBitmap(file)
  const scale = Math.min(1, 1600 / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.85)
}
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
        body: { postUrl: data.get('postUrl'), text: data.get('text'), image },
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
        Share an event from Instagram, TikTok or anywhere else. Add the caption, a screenshot of the poster, or both.
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
          Caption (optional)
          <textarea name="text" maxLength={5000} placeholder="Paste the post’s text here" />
        </label>
        <label>
          Poster screenshot (optional)
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
