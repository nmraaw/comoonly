import { Link } from 'react-router-dom'
import { useApi } from '../api'
import type { EventItem } from '../types'
import DetailHeader from '../components/DetailHeader'
import EventCard from '../components/EventCard'
import { Empty } from '../components/UI'
// Upcoming events (approved by an admin). Each links to its official page and has a group to go together.
export default function Events() {
  const { data, error } = useApi<EventItem[]>('/events')
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
        <EventCard key={e.id} event={e} />
      ))}
    </>
  )
}
