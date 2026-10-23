import { Link, useSearchParams } from 'react-router-dom'
import type { User } from '../types'
import { api, useApi } from '../api'
import { Chips, Empty, Avatar } from '../components/UI'
import Chat from '../components/Chat'
import NotFound from '../components/NotFound'
import DetailHeader from '../components/DetailHeader'

type Person = { id: string; name: string; city: string }
type Conversations = {
  groups: { id: string; name: string; color: string; last: string | null }[]
  people: { id: string; name: string; last: string | null }[]
}

// A private chat with one connection (/messages?chat=<userId>).
function PrivateChat({ id }: { id: string }) {
  const { data: user, error } = useApi<User>('/users/' + encodeURIComponent(id))
  if (error) return <NotFound type="Conversation" />
  if (!user) return <Empty>Loading…</Empty>
  return (
    <>
      <DetailHeader title={user.name} fallback="/messages" />
      <Link className="text-button" to={'/users/' + id}>
        View profile →
      </Link>
      {user.connection === 'accepted' ? (
        <Chat key={id} path={'/messages/with/' + id} />
      ) : (
        <Empty>
          Connect before sending a private message.
          <Link className="button" to={'/users/' + id}>
            View profile →
          </Link>
        </Empty>
      )}
    </>
  )
}

export default function Messages() {
  const [params, setParams] = useSearchParams()
  const tab = ['All', 'Groups', 'Requests'].includes(params.get('view') || '') ? params.get('view')! : 'All'
  const chat = params.get('chat')
  const list = useApi<Conversations>(chat ? null : '/messages')
  const connections = useApi<{ incoming: Person[]; outgoing: Person[] }>(chat ? null : '/connections')
  if (chat) return <PrivateChat id={chat} />
  const incoming = connections.data?.incoming || []
  const outgoing = connections.data?.outgoing || []
  async function answer(userId: string, decision: 'accept' | 'decline') {
    try {
      await api('/connections/' + userId, { method: 'POST', body: { decision } })
    } catch (err) {
      alert((err as Error).message)
    }
    connections.reload()
    list.reload()
  }
  return (
    <>
      <header className="page-top">
        <strong>Messages</strong>
      </header>
      <h1>Your conversations</h1>
      <Chips
        label="Conversation filter"
        values={['All', 'Groups', 'Requests']}
        value={tab}
        onChange={(view) => setParams({ view })}
      />
      {tab === 'Requests' ? (
        <>
          {incoming.map((user) => (
            <article className="profile-card lilac" key={user.id}>
              <Link to={'/users/' + user.id}>
                <Avatar name={user.name} />
                <h2>{user.name}</h2>
              </Link>
              <p>{user.city ? user.city + ' · ' : ''}wants to connect with you.</p>
              <div className="two-actions">
                <button className="button" onClick={() => answer(user.id, 'decline')}>
                  Decline
                </button>
                <button className="button lime" onClick={() => answer(user.id, 'accept')}>
                  Accept
                </button>
              </div>
            </article>
          ))}
          {outgoing.map((user) => (
            <article className="notice mint" key={user.id}>
              <Link to={'/users/' + user.id}>
                <h2>{user.name}</h2>
              </Link>
              <p>Your connection request is pending.</p>
            </article>
          ))}
          {connections.data && !incoming.length && !outgoing.length && <Empty>No message requests.</Empty>}
        </>
      ) : (
        <div className="stack">
          {tab === 'All' &&
            list.data?.people.map((p) => (
              <Link className="conversation lilac" key={p.id} to={'?chat=' + p.id}>
                <Avatar name={p.name} />
                <div>
                  <h2>{p.name}</h2>
                  <p>{p.last || 'Say hello'}</p>
                </div>
              </Link>
            ))}
          {list.data?.groups.map((g) => (
            <Link key={g.id} className={'conversation ' + g.color} to={'/groups/' + g.id + '?tab=Chat'}>
              <div>
                <h2>{g.name}</h2>
                <p>{g.last || 'Your group is ready.'} · Group chat →</p>
              </div>
            </Link>
          ))}
          {list.data && !list.data.groups.length && !(tab === 'All' && list.data.people.length) && (
            <Empty>
              No conversations yet.
              <Link className="button" to="/">
                Find a group →
              </Link>
            </Empty>
          )}
          {tab === 'All' && incoming.length > 0 && (
            <button className="conversation" onClick={() => setParams({ view: 'Requests' })}>
              <div>
                <h2>Message requests</h2>
                <p>{incoming.length} waiting for you →</p>
              </div>
            </button>
          )}
        </div>
      )}
    </>
  )
}
