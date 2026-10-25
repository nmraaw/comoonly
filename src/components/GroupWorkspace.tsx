import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import type { EventItem } from '../types'
import { Avatar, Chips, Empty } from './UI'
import EventDetails from './EventDetails'
import Chat from './Chat'
import DetailHeader from './DetailHeader'
import { api, useApi } from '../api'
export default function GroupWorkspace({ id }: { id: string }) {
  const { me, groups, refresh } = useApp()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const group = groups.find((g) => g.id === id)
  // An event's group or crew opens on the event itself (poster, details, links); other groups on their chat.
  const sections = group?.forEvent ? ['Event', 'Chat', 'Members'] : ['Chat', 'Members']
  const tab = sections.includes(params.get('tab') || '') ? params.get('tab')! : sections[0]
  const event = useApi<EventItem>(group?.forEvent ? '/events/for-group/' + id : null)
  const host = group?.ownerId === me!.id
  const members = useApi<{ id: string; name: string; role: string }[]>('/groups/' + id + '/members')
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
  const kind = group.crewFor ? 'your crew' : group.forEvent ? 'everyone going' : 'your group'
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
      {group.crewFor && (
        <p className="notice mint">
          📍 <strong>Meeting: {group.description}</strong>
          {group.womenOnly && ' · 👩 Women only'}
        </p>
      )}
      {/* `replace`: switching tabs isn't a new page, so the back arrow leaves the group in one tap. */}
      <Chips
        label="Group sections"
        values={sections}
        value={tab}
        onChange={(v) => setParams({ tab: v }, { replace: true })}
      />
      {tab === 'Chat' && <Chat path={'/groups/' + id + '/messages'} />}
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
              Leave group
            </button>
          )}
        </>
      )}
    </>
  )
}
