import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import type { EventItem } from '../types'
import { Avatar, Chips, Empty, Modal } from './UI'
import EventCard from './EventCard'
import MemoryCard from './MemoryCard'
import CrewPlan from './CrewPlan'
import { aboutInterest, INTERESTS } from '../interests'
import EventDetails from './EventDetails'
import Chat from './Chat'
import DetailHeader from './DetailHeader'
import { api, useApi } from '../api'
export default function GroupWorkspace({ id }: { id: string }) {
  const { me, groups, refresh } = useApp()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const group = groups.find((g) => g.id === id)
  // An event's group or crew opens on the event itself (poster, details, links); a community on what's coming up.
  const sections = group?.crewFor
    ? ['Event', 'Chat', 'Plan', 'Members']
    : group?.forEvent
      ? ['Event', 'Chat', 'Members']
      : ['Upcoming', 'Chat', 'Members']
  const tab = sections.includes(params.get('tab') || '') ? params.get('tab')! : sections[0]
  const event = useApi<EventItem>(group?.forEvent ? '/events/for-group/' + id : null)
  const host = group?.ownerId === me!.id
  // A community's Upcoming tab: published events about its interest, near it (or online).
  const allEvents = useApi<EventItem[]>(group && !group.forEvent ? '/events' : null)
  const upcoming = (allEvents.data ?? []).filter(
    (e) =>
      aboutInterest(group!.category, e) &&
      (e.mode !== 'In person' || group!.mode === 'Online' || e.city.toLowerCase() === group!.location.toLowerCase()),
  )
  const [editing, setEditing] = useState(false)
  const [keeping, setKeeping] = useState(false)
  const [memory, setMemory] = useState(false)
  const [interest, setInterest] = useState('Meetups')
  const members = useApi<{ id: string; name: string; role: string; area: string }[]>('/groups/' + id + '/members')
  const requests = useApi<{ id: string; name: string; city: string; intro: string }[]>(
    host ? '/groups/' + id + '/requests' : null,
  )
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
  if (!group) return <Empty>Group not found.</Empty>
  const kind = group.crewFor ? 'your crew' : group.forEvent ? 'general chat' : 'community'
  // The pinned plan; a crew's starts as the meeting plan its organizer wrote.
  const pinned = group.pinned || (group.crewFor ? 'Meeting: ' + group.description : '')
  const over = Boolean(group.crewFor && event.data && new Date(event.data.date) < new Date())
  const savePinned = (form: HTMLFormElement) =>
    run(
      api('/groups/' + id + '/pinned', { method: 'PUT', body: { pinned: new FormData(form).get('pinned') } })
        .then(refresh)
        .then(() => setEditing(false)),
    )
  const keep = (form: HTMLFormElement) =>
    run(
      api('/groups/' + id + '/keep', {
        method: 'POST',
        body: { name: new FormData(form).get('name'), category: interest },
      })
        .then(refresh)
        .then(() => (setKeeping(false), setParams({ tab: 'Chat' }, { replace: true }))),
    )
  return (
    <>
      <DetailHeader title={group.name} fallback="/groups" />
      <div className="crew">
        {(members.data || []).slice(0, 3).map((m) => (
          <Avatar key={m.id} id={m.id} name={m.name} />
        ))}
        <small>
          {group.members} {group.members === 1 ? 'person' : 'people'} · {kind}
        </small>
      </div>
      {editing ? (
        <form className="notice mint" onSubmit={(e) => (e.preventDefault(), savePinned(e.currentTarget))}>
          <label>
            Pinned plan
            <input name="pinned" maxLength={200} defaultValue={pinned} placeholder="Meet at Gate 2, 5:45" autoFocus />
          </label>
          <div className="two-actions">
            <button type="button" className="button" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button className="button lime">Pin it</button>
          </div>
        </form>
      ) : (
        <p className="notice mint pinned">
          📌 <strong>{pinned || 'No plan pinned yet'}</strong>
          {group.womenOnly && ' · 👩 Women only'}
          <button className="text-button" onClick={() => setEditing(true)}>
            {pinned ? 'Edit' : 'Pin a plan'}
          </button>
        </p>
      )}
      {over && (
        <article className="notice lilac">
          <strong>Same crew next time? 🫶</strong>
          <p>
            {host
              ? 'Keep this crew as a community: same people, same chat, and you hear about the next events together.'
              : `${group.owner.split(' ')[0]} can keep this crew going as a community. Tell them in the chat!`}
          </p>
          {host && (
            <button className="button lime" onClick={() => setKeeping(true)}>
              Keep this crew going →
            </button>
          )}
          <button className="button" onClick={() => setMemory(true)}>
            📸 Make our memory card
          </button>
        </article>
      )}
      {memory && event.data && members.data && (
        <MemoryCard group={group} event={event.data} people={members.data} onClose={() => setMemory(false)} />
      )}
      {keeping && (
        <Modal title="Keep the crew going" onClose={() => setKeeping(false)}>
          <form onSubmit={(e) => (e.preventDefault(), keep(e.currentTarget))}>
            <label>
              Community name
              <input name="name" required maxLength={70} defaultValue={group.name.split(' · ')[0]} />
            </label>
            <Chips label="What are you into?" values={INTERESTS} value={interest} onChange={setInterest} />
            <button className="button primary">Make it a community →</button>
          </form>
        </Modal>
      )}
      {/* `replace`: switching tabs isn't a new page, so the back arrow leaves the group in one tap. */}
      <Chips
        label="Group sections"
        values={sections}
        value={tab}
        onChange={(v) => setParams({ tab: v }, { replace: true })}
      />
      {tab === 'Chat' && <Chat path={'/groups/' + id + '/messages'} />}
      {tab === 'Plan' && members.data && (
        <CrewPlan group={group} city={event.data?.city ?? ''} members={members.data} onArea={members.reload} />
      )}
      {tab === 'Upcoming' && (
        <>
          <p className="hint">
            What’s coming up for {group.category.toLowerCase()}{' '}
            {group.mode === 'Online' ? 'online' : 'in ' + group.location}. Going? Start a crew on the event and invite
            people from here.
          </p>
          {upcoming.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
          {allEvents.data && !upcoming.length && (
            <Empty>No {group.category.toLowerCase()} events coming up yet. Plan something in the chat!</Empty>
          )}
        </>
      )}
      {tab === 'Event' && (
        <>
          {event.data && <EventDetails event={event.data} />}
          {event.error && <Empty>{event.error}</Empty>}
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
                    <Avatar id={r.id} name={r.name} />
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
              <Avatar id={m.id} name={m.name} />
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
              Leave {group.forEvent ? 'chat' : 'community'}
            </button>
          )}
        </>
      )}
    </>
  )
}
