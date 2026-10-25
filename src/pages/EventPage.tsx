import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { api, useApi } from '../api'
import type { EventItem } from '../types'
import { eventCalendar } from '../events'
import DetailHeader from '../components/DetailHeader'
import EventDetails from '../components/EventDetails'
import NotFound from '../components/NotFound'
import { CalendarPopup } from '../components/AddToCalendar'
import { Empty } from '../components/UI'

// One event: what it is first; going together (the group and its chat) comes after.
export default function EventPage() {
  const { id } = useParams()
  const { refresh, membership } = useApp()
  const { data: e, error, reload } = useApi<EventItem>('/events/' + encodeURIComponent(id!))
  const [busy, setBusy] = useState(false)
  const [asking, setAsking] = useState(false) // just joined: offer the calendar
  if (error) return <NotFound type="Event" to="/events" />
  if (!e) return <Empty>Loading…</Empty>
  const going = Boolean(e.groupId && membership[e.groupId] === 'joined')
  async function goWith() {
    setBusy(true)
    try {
      await api('/events/' + e!.id + '/go', { method: 'POST' })
      await refresh()
      reload()
      setAsking(true)
    } catch (err) {
      alert((err as Error).message)
    }
    setBusy(false)
  }
  return (
    <>
      <DetailHeader title="Event" fallback="/events" />
      <EventDetails event={e}>
        {going ? (
          <Link className="button primary" to={'/groups/' + e.groupId + '?tab=Chat'}>
            ✓ You’re going · Open the group chat →
          </Link>
        ) : (
          <>
            <button className="button primary" disabled={busy} onClick={goWith}>
              {busy ? 'One moment…' : 'I want to go · Find people →'}
            </button>
            <p className="hint">Join the people from Comoonly who are going, and plan it together. Free.</p>
          </>
        )}
      </EventDetails>
      {asking && <CalendarPopup {...eventCalendar(e)} onClose={() => setAsking(false)} />}
    </>
  )
}
