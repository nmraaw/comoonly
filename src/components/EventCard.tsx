import { Link } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import type { EventItem } from '../types'
import { eventPlace, eventWhen } from '../events'
import { Mascot } from './UI'

// One published event in a list (Discover, the Events page). Everything else is on its own page.
export default function EventCard({ event: e }: { event: EventItem }) {
  const { membership } = useApp()
  const going = Boolean(e.groupId && membership[e.groupId] === 'joined')
  return (
    <article className="group-card expanded" data-card-id={e.id}>
      {Boolean(e.hasPoster) && (
        <Link to={'/events/' + e.id} tabIndex={-1} aria-hidden="true">
          <img className="event-poster" src={`/api/events/${e.id}/poster`} alt="" loading="lazy" />
        </Link>
      )}
      <div className="event-head">
        <div>
          <small>
            <strong>{eventWhen(e)}</strong> · {eventPlace(e)}
          </small>
          <Link className="card-title" to={'/events/' + e.id}>
            <h2>{e.title}</h2>
          </Link>
        </div>
        {!e.hasPoster && <Mascot seed={e.id} />}
      </div>
      <div className="meta">
        <span className="chip selected">{e.category}</span>
        <small>{going ? 'You’re going' : e.goingCount ? `${e.goingCount} going together` : 'Be the first to go'}</small>
      </div>
      <Link className="button primary" to={'/events/' + e.id}>
        See event →
      </Link>
    </article>
  )
}
