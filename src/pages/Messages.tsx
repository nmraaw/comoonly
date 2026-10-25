import { Link, useSearchParams } from 'react-router-dom'
import type { User } from '../types'
import { api, useApi } from '../api'
import { Avatar, Chips, Empty, Mascot } from '../components/UI'
import Chat from '../components/Chat'
import NotFound from '../components/NotFound'
import DetailHeader from '../components/DetailHeader'

type Person = { id: string; name: string; city: string }
// Private chats only; group chats live inside each group.
type Conversations = { people: { id: string; name: string; last: string | null }[] }

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
  const tab = params.get('view') === 'Requests' ? 'Requests' : 'Chats'
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
        values={['Chats', 'Requests']}
        value={tab}
        onChange={(view) => setParams({ view }, { replace: true })}
      />
      {tab === 'Requests' ? (
        <>
          {incoming.map((user) => (
            <article className="profile-card lilac" key={user.id}>
              <Link to={'/users/' + user.id}>
                <Avatar id={user.id} name={user.name} />
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
          {list.data?.people.map((p) => (
            <Link className="conversation lilac person-chat" key={p.id} to={'?chat=' + p.id}>
              <Mascot seed={p.id} />
              <div>
                <h2>{p.name}</h2>
                <p>{p.last || 'Accepted connection · say hello'}</p>
              </div>
            </Link>
          ))}
          {list.data && !list.data.people.length && (
            <Empty>
              No private chats yet. Meet people in a group, connect from their profile, then say hello here.
              <Link className="button" to="/groups">
                Your groups →
              </Link>
            </Empty>
          )}
          {incoming.length > 0 && (
            <button className="conversation" onClick={() => setParams({ view: 'Requests' }, { replace: true })}>
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
