import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import type { Activity, EventItem } from '../types'
import { Avatar, Chips, Empty, Modal } from './UI'
import EventDetails from './EventDetails'
import Chat from './Chat'
import DetailHeader from './DetailHeader'
import { api, useApi } from '../api'
import { CalendarPopup } from './AddToCalendar'
import { activityCalendar } from '../calendar'
const when = (date: string) => new Date(date).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
export default function GroupWorkspace({ id }: { id: string }) {
  const { me, groups, refresh } = useApp()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const group = groups.find((g) => g.id === id)
  // An event's group opens on the event itself (poster, details, links); other groups on their chat.
  const sections = group?.forEvent ? ['Event', 'Chat', 'Activities', 'Members'] : ['Chat', 'Activities', 'Members']
  const tab = sections.includes(params.get('tab') || '') ? params.get('tab')! : sections[0]
  const event = useApi<EventItem>(group?.forEvent ? '/events/for-group/' + id : null)
  const [planning, setPlanning] = useState(false)
  const [error, setError] = useState('')
  const [joinedActivity, setJoinedActivity] = useState<Activity>() // just joined: offer the calendar
  const host = group?.ownerId === me!.id
  const members = useApi<{ id: string; name: string; role: string }[]>('/groups/' + id + '/members')
  const requests = useApi<{ id: string; name: string; city: string; intro: string }[]>(
    host ? '/groups/' + id + '/requests' : null,
  )
  const activities = useApi<Activity[]>('/groups/' + id + '/activities')
  // Every change goes to the server first; then the list is loaded again so everyone sees the same thing.
  async function run(action: Promise<unknown>, ...lists: { reload: () => void }[]) {
    try {
      await action
    } catch (err) {
      alert((err as Error).message)
    }
    lists.forEach((l) => l.reload())
  }
  const decide = (userId: string, decision: 'accept' | 'decline') =>
    run(
      api('/groups/' + id + '/requests/' + userId, { method: 'POST', body: { decision } }).then(refresh),
      requests,
      members,
    )
  async function submit(f: HTMLFormElement) {
    const data = Object.fromEntries(new FormData(f))
    setError('')
    try {
      await api('/groups/' + id + '/activities', { method: 'POST', body: data })
      activities.reload()
      setPlanning(false)
    } catch (err) {
      setError((err as Error).message)
    }
  }
  if (!group) return <Empty>Group not found.</Empty>
  const events = activities.data || []
  return (
    <>
      <DetailHeader title={group.name} fallback="/groups" />
      <div className="crew">
        {(members.data || []).slice(0, 3).map((m) => (
          <Avatar key={m.id} name={m.name} />
        ))}
        <small>
          {group.members} {group.members === 1 ? 'person' : 'people'} · your crew
        </small>
      </div>
      {group.crewFor && (
        <p className="notice mint">
          📍 <strong>Meeting: {group.description}</strong>
          {group.womenOnly && ' · 👩 Women only'}
        </p>
      )}
      <Chips label="Group sections" values={sections} value={tab} onChange={(v) => setParams({ tab: v })} />
      {tab === 'Chat' && (
        <>
          <button className="activity-card lilac" onClick={() => setParams({ tab: 'Activities' })}>
            <h2>{events[0]?.title || 'Make your first little plan.'}</h2>
            <p>{events[0] ? when(events[0].date) + ' · ' + events[0].place : 'Plan something together'}</p>
            <strong>View activities →</strong>
          </button>
          <Chat path={'/groups/' + id + '/messages'} />
        </>
      )}
      {tab === 'Event' && (
        <>
          {event.data && <EventDetails event={event.data} />}
          {event.error && <Empty>{event.error}</Empty>}
        </>
      )}
      {tab === 'Activities' && (
        <>
          {events.map((event) => (
            <article className="activity-card lilac" key={event.id}>
              <small>
                {when(event.date)} · {event.goingCount} going
              </small>
              <Link to={'/activities/' + event.id}>
                <h2>{event.title}</h2>
                <span className="text-button">View activity →</span>
              </Link>
              <p>{event.place}</p>
              <button
                className={'button ' + (event.going ? 'lime' : '')}
                aria-pressed={event.going}
                onClick={async () => {
                  await run(api('/activities/' + event.id + '/going', { method: 'POST' }), activities)
                  if (!event.going) setJoinedActivity(event)
                }}
              >
                {event.going ? '✓ I’m going' : 'Join activity'}
              </button>
            </article>
          ))}
          {activities.data && !events.length && <Empty>No activities yet.</Empty>}
          {joinedActivity && (
            <CalendarPopup {...activityCalendar(joinedActivity)} onClose={() => setJoinedActivity(undefined)} />
          )}
          <button className="button" onClick={() => setPlanning(true)}>
            ＋ Plan an activity
          </button>
        </>
      )}
      {tab === 'Members' && (
        <>
          {host && !!requests.data?.length && (
            <>
              <h2 className="section-title">Join requests</h2>
              {requests.data.map((r) => (
                <article className="notice lilac" key={r.id}>
                  <Link className="member-row" to={'/users/' + r.id}>
                    <Avatar name={r.name} />
                    <span>
                      <strong>{r.name}</strong>
                      <small>{r.city}</small>
                    </span>
                  </Link>
                  <p>{r.intro}</p>
                  <div className="two-actions">
                    <button className="button" onClick={() => decide(r.id, 'decline')}>
                      Decline
                    </button>
                    <button className="button lime" onClick={() => decide(r.id, 'accept')}>
                      Accept
                    </button>
                  </div>
                </article>
              ))}
            </>
          )}
          <h2 className="section-title">Members</h2>
          {members.data?.map((m) => (
            <Link className="member-row" key={m.id} to={'/users/' + m.id}>
              <Avatar name={m.name} />
              <span>
                <strong>{m.name}</strong>
                <small>{m.role}</small>
              </span>
            </Link>
          ))}
          {members.error && <Empty>{members.error}</Empty>}
          {!host && (
            <button
              className="text-button"
              onClick={() =>
                confirm(`Leave ${group.name}? You can ask to join again later.`) &&
                api('/groups/' + id + '/leave', { method: 'POST' })
                  .then(() => refresh())
                  .then(
                    () => navigate('/groups'),
                    (err) => alert(err.message),
                  )
              }
            >
              Leave group
            </button>
          )}
        </>
      )}
      {planning && (
        <Modal
          title="A plan for your group."
          onClose={() => {
            setPlanning(false)
            setError('')
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault()
              submit(e.currentTarget)
            }}
          >
            <label>
              What’s the plan?
              <input name="title" required maxLength={100} placeholder="Name your little plan" />
            </label>
            <label>
              When
              <input type="datetime-local" name="date" required />
            </label>
            <label>
              Meeting place
              <input name="place" required maxLength={120} placeholder="A public place, or online" />
            </label>
            <label>
              The very loose plan (optional, one step per line)
              <textarea
                name="plan"
                maxLength={500}
                placeholder={'Read one chapter\nShare one passage\nKeep it spoiler-free'}
              />
            </label>
            <label>
              Before you go (optional)
              <input name="notes" maxLength={500} placeholder="Bring one passage that stayed with you." />
            </label>
            {error && (
              <p className="notice pink" role="alert">
                {error}
              </p>
            )}
            <button className="button lime">Save plan →</button>
          </form>
        </Modal>
      )}
    </>
  )
}
