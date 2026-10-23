import { useState } from 'react'
import { api, useApi } from '../api'
import { Empty } from '../components/UI'
import type { EventItem } from '../types'
type Report = { source: string; via?: string; found?: number; added?: number; error?: string }[]

// The same fields for editing a found event and for adding one by hand.
function Fields({ e }: { e?: Partial<EventItem> }) {
  return (
    <>
      <label>
        Title
        <input name="title" required maxLength={200} defaultValue={e?.title} />
      </label>
      <label>
        Starts
        <input
          name="date"
          type="datetime-local"
          required
          defaultValue={e?.date && (e.date.length === 10 ? e.date + 'T00:00' : e.date.slice(0, 16))}
        />
      </label>
      {/* some sites give only a day */}
      <label>
        City
        <input name="city" maxLength={80} defaultValue={e?.city} />
      </label>
      <label>
        How
        <select name="mode" defaultValue={e?.mode ?? 'In person'}>
          <option>In person</option>
          <option>Online</option>
          <option>Hybrid</option>
        </select>
      </label>
      <label>
        Category
        <input name="category" required maxLength={40} defaultValue={e?.category ?? 'Event'} />
      </label>
      <label>
        About
        <textarea name="description" maxLength={1000} defaultValue={e?.description} />
      </label>
      <label>
        Official registration link
        <input name="registerUrl" type="url" required defaultValue={e?.registerUrl} />
      </label>
      <label>
        Registration closes (optional)
        <input name="deadline" type="date" defaultValue={e?.deadline} />
      </label>
    </>
  )
}

// The date field can't be left without a time; midnight means "no time given", so save just the day.
const values = (form: HTMLFormElement) => {
  const data = Object.fromEntries(new FormData(form)) as Record<string, string>
  data.date = data.date.replace(/T00:00$/, '')
  return data
}

// Admins only: run the finder, then approve, fix or reject what it found. Nothing goes live on its own.
export default function ReviewEvents() {
  const drafts = useApi<EventItem[]>('/events/review')
  const [report, setReport] = useState<Report | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function scan() {
    setBusy(true)
    setReport(null)
    try {
      setReport(await api<Report>('/events/scan', { method: 'POST' }))
      drafts.reload()
    } catch (err) {
      alert((err as Error).message)
    }
    setBusy(false)
  }
  async function review(id: string, form: HTMLFormElement, status: 'published' | 'rejected') {
    try {
      await api('/events/' + id, { method: 'PATCH', body: { ...values(form), status } })
      drafts.reload()
    } catch (err) {
      alert((err as Error).message)
    }
  }
  async function add(form: HTMLFormElement) {
    const data = values(form)
    try {
      await api('/events', { method: 'POST', body: { ...data, sourceUrl: data.registerUrl } })
      form.reset()
      setMessage('Published. It’s on the Events page now.')
    } catch (err) {
      setMessage((err as Error).message)
    }
  }
  return (
    <>
      <h1>
        New events,
        <br />
        checked by you.
      </h1>
      <button className="button primary" disabled={busy} onClick={scan}>
        {busy ? 'Looking… this can take a minute' : 'Find new events'}
      </button>
      {report && (
        <div className="notice mint">
          {report.map((r) => (
            <p key={r.source}>
              <strong>{r.source}</strong>:{' '}
              {r.error ? 'couldn’t read it (' + r.error + ')' : `${r.found} found via ${r.via}, ${r.added} new`}
            </p>
          ))}
        </div>
      )}
      <h2 className="section-title">Waiting for review</h2>
      {drafts.data && !drafts.data.length && <Empty>Nothing waiting. Press “Find new events”.</Empty>}
      {drafts.data?.map((e) => (
        <form
          className="group-card expanded"
          key={e.id}
          onSubmit={(ev) => {
            ev.preventDefault()
            review(e.id, ev.currentTarget, 'published')
          }}
        >
          <small>
            <a className="text-button" href={e.sourceUrl} target="_blank" rel="noopener noreferrer">
              {e.suggestedBy ? `Suggested by ${e.suggestedBy}` : 'Found'} on {new URL(e.sourceUrl).hostname} ↗
            </a>
          </small>
          <Fields e={e} />
          <div className="two-actions">
            <button type="button" className="button" onClick={(ev) => review(e.id, ev.currentTarget.form!, 'rejected')}>
              Reject
            </button>
            <button className="button lime">Publish</button>
          </div>
        </form>
      ))}
      <a className="button" href="/events/suggest" target="_blank" rel="noreferrer">
        Add from an Instagram or TikTok post →
      </a>
      <h2 className="section-title">Add an event yourself</h2>
      <form
        onSubmit={(ev) => {
          ev.preventDefault()
          add(ev.currentTarget)
        }}
      >
        <Fields />
        {message && (
          <p className="notice mint" role="status">
            {message}
          </p>
        )}
        <button className="button primary">Publish event</button>
      </form>
    </>
  )
}
