import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { api, useApi } from '../api'
import type { EventItem } from '../types'
import DetailHeader from '../components/DetailHeader'
import { Empty, Mascot } from '../components/UI'
// Upcoming events (approved by an admin). Each links to its official page and has a group to go together.
export default function Events() {
  const { refresh } = useApp()
  const navigate = useNavigate()
  const { data, error } = useApi<EventItem[]>('/events')
  const [busy, setBusy] = useState('')
  async function goWith(id: string) {
    setBusy(id)
    try {
      const { groupId } = await api<{ groupId: string }>('/events/' + id + '/go', { method: 'POST' })
      await refresh()
      navigate('/groups/' + groupId + '?tab=Chat')
    } catch (err) {
      alert((err as Error).message)
      setBusy('')
    }
  }
  return (
    <>
      <DetailHeader title="Events" fallback="/" />
      <h1>
        Things happening.
        <br />
        Go together.
      </h1>
      <Link className="button lime" to="/events/suggest">
        ＋ Suggest an event
      </Link>
      {error && <Empty>{error}</Empty>}
      {data && !data.length && <Empty>No upcoming events yet. Check back soon.</Empty>}
      {data?.map((e) => (
        <article className="group-card expanded" key={e.id}>
          <div className="event-head">
            <div>
              <small>
                {new Date(e.date).toLocaleString('en-GB', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  ...(e.date.length > 10 && { hour: '2-digit', minute: '2-digit' }),
                })}
              </small>
              <h2>{e.title}</h2>
            </div>
            <Mascot seed={e.id} />
          </div>
          {e.description && <p>{e.description}</p>}
          <div className="meta">
            <span className="chip selected">{e.category}</span>
            <small>
              {[e.mode, e.city].filter(Boolean).join(' · ')}
              {e.goingCount ? ` · ${e.goingCount} going together` : ''}
            </small>
          </div>
          {e.deadline && (
            <p className="hint">
              Register by {new Date(e.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </p>
          )}
          <a className="button" href={e.registerUrl} target="_blank" rel="noopener noreferrer">
            Official page ↗
          </a>
          <button className="button primary" disabled={busy === e.id} onClick={() => goWith(e.id)}>
            {busy === e.id ? 'One moment…' : 'Find people to go with →'}
          </button>
        </article>
      ))}
    </>
  )
}
