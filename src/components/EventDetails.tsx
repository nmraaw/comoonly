import type { ReactNode } from 'react'
import type { EventItem } from '../types'
import { eventCalendar, eventCountdown, eventPlace, eventWhen } from '../events'
import AddToCalendar from './AddToCalendar'
import Icon from './Icon'

// Everything about one event, the event first: poster, heading, when and where (bold), then the main
// actions (`children`), then the details and side actions. On the event's page and its group's Event tab.
export default function EventDetails({ event: e, children }: { event: EventItem; children?: ReactNode }) {
  const countdown = eventCountdown(e)
  async function share() {
    const url = location.origin + '/events/' + e.id
    try {
      if (navigator.share) await navigator.share({ title: e.title, url })
      else {
        await navigator.clipboard.writeText(url)
        alert('Link copied. Send it to a friend!')
      }
    } catch {
      // closing the share sheet isn't an error
    }
  }
  return (
    <>
      {Boolean(e.hasPoster) && (
        <img className="event-poster" src={`/api/events/${e.id}/poster`} alt={`Poster for ${e.title}`} />
      )}
      <div className="chips">
        <span className="chip selected">{e.category}</span>
        {countdown && <span className="chip">{countdown}</span>}
      </div>
      <h1>{e.title}</h1>
      <div className="notice info-rows">
        <p>
          <Icon name="clock" />
          <strong>{eventWhen(e)}</strong>
        </p>
        <p>
          <Icon name="pin" />
          <strong>{eventPlace(e)}</strong>
        </p>
        <p>
          <Icon name="Groups" />
          {e.goingCount ? `${e.goingCount} from Comoonly going together` : 'Nobody from Comoonly yet. Be the first!'}
        </p>
      </div>
      {e.deadline && (
        <p className="notice pink">
          <strong>
            Register by {new Date(e.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}
          </strong>
        </p>
      )}
      {children}
      <a className="button" href={e.registerUrl} target="_blank" rel="noopener noreferrer">
        Register on the official page ↗
      </a>
      {e.description && (
        <>
          <h2 className="section-title">About</h2>
          <p>{e.description}</p>
        </>
      )}
      <AddToCalendar {...eventCalendar(e)} />
      <button className="button" onClick={share}>
        Share with a friend
      </button>
    </>
  )
}
