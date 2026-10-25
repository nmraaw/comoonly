import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { api } from '../api'
import type { EventItem } from '../types'
import { Mascot } from './UI'
import Icon from './Icon'
import AddToCalendar, { CalendarPopup } from './AddToCalendar'

// One published event, on Discover, the Events page and (inGroup) its own group's pages.
export default function EventCard({ event: e, inGroup = false }: { event: EventItem; inGroup?: boolean }) {
  const { refresh, membership } = useApp()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [newGroup, setNewGroup] = useState('') // just joined: ask about the calendar, then open the chat
  const joined = Boolean(e.groupId && membership[e.groupId] === 'joined')
  async function goWith() {
    setBusy(true)
    try {
      const { groupId } = await api<{ groupId: string }>('/events/' + e.id + '/go', { method: 'POST' })
      await refresh()
      if (joined) navigate('/groups/' + groupId)
      else setNewGroup(groupId)
    } catch (err) {
      alert((err as Error).message)
      setBusy(false)
    }
  }
  const when = new Date(e.date).toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(e.date.slice(0, 4) !== String(new Date().getFullYear()) && { year: 'numeric' }),
    ...(e.date.length > 10 && { hour: '2-digit', minute: '2-digit' }),
  })
  const place = [e.mode === 'In person' ? '' : e.mode, e.city].filter(Boolean).join(' · ') || 'In person'
  const calendar = {
    title: e.title,
    date: e.date,
    place: e.mode === 'Online' ? 'Online' : e.city,
    details: `${e.description}\n\nRegister: ${e.registerUrl}`.trim(),
    ics: `/events/${e.id}/calendar.ics`,
  }
  return (
    <article className="group-card expanded" data-card-id={e.id}>
      {Boolean(e.hasPoster) && (
        <img className="event-poster" src={`/api/events/${e.id}/poster`} alt={`Poster for ${e.title}`} loading="lazy" />
      )}
      <div className="event-head">
        <div>
          {!inGroup && <small>{when}</small>}
          <h2>{e.title}</h2>
        </div>
        {!e.hasPoster && <Mascot seed={e.id} />}
      </div>
      {/* On the event's own pages, when and where come first, in bold. */}
      {inGroup && (
        <div className="notice info-rows">
          <p>
            <Icon name="clock" />
            <strong>{when}</strong>
          </p>
          <p>
            <Icon name="pin" />
            <strong>{place}</strong>
          </p>
          <p>
            <Icon name="Groups" />
            {e.goingCount} going together
          </p>
        </div>
      )}
      {e.description && <p>{e.description}</p>}
      <div className="meta">
        <span className="chip selected">{e.category}</span>
        {!inGroup && (
          <small>
            {[e.mode, e.city].filter(Boolean).join(' · ')}
            {e.goingCount ? ` · ${e.goingCount} going together` : ''}
          </small>
        )}
      </div>
      {e.deadline && (
        <p className="hint">
          Register by {new Date(e.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        </p>
      )}
      <a className="button" href={e.registerUrl} target="_blank" rel="noopener noreferrer">
        Official page ↗
      </a>
      {!inGroup && (
        <button className="button primary" disabled={busy} onClick={goWith}>
          {busy ? 'One moment…' : joined ? 'Open event group →' : 'Find people to go with →'}
        </button>
      )}
      {joined && !newGroup && <AddToCalendar {...calendar} />}
      {newGroup && <CalendarPopup {...calendar} onClose={() => navigate('/groups/' + newGroup)} />}
    </article>
  )
}
