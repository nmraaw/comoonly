import { Link, useSearchParams } from 'react-router-dom'
import type { User } from '../types'
import { api, useApi } from '../api'
import { Avatar, Chips, Empty } from '../components/UI'
import Chat from '../components/Chat'
import NotFound from '../components/NotFound'
import DetailHeader from '../components/DetailHeader'

type Person = { id: string; name: string; city: string; message?: string | null }
type Conversations = {
  people: { id: string; name: string; status: 'accepted' | 'pending'; last: string | null }[]
  groups: { id: string; name: string; color: string; last: string | null }[]
}

// A private chat with one person (/messages?chat=<userId>). Not connected yet: the first message is a request.
function PrivateChat({ id }: { id: string }) {
  const { data: user, error, reload } = useApi<User>('/users/' + encodeURIComponent(id))
  if (error) return <NotFound type="Conversation" />
  if (!user) return <Empty>Loading…</Empty>
  const first = user.name.split(' ')[0]
  async function answer(decision: 'accept' | 'decline') {
    try {
      await api('/connections/' + id, { method: 'POST', body: { decision } })
    } catch (err) {
      alert((err as Error).message)
    }
    reload()
  }
  return (
    <>
      <DetailHeader title={user.name} fallback="/messages" />
      <Link className="member-row" to={'/users/' + id}>
        <Avatar id={id} name={user.name} />
        <span>
          <strong>{user.name}</strong>
          <small>View profile →</small>
        </span>
      </Link>
      {user.blocked ? (
        <Empty>You blocked {first}. Unblock them from their profile to message again.</Empty>
      ) : (
        <>
          {user.connection === 'incoming' && (
            <div className="notice lilac">
              <p>
                <strong>{first} sent you a message request.</strong> Reply or accept to chat. They won’t know if you
                ignore it.
              </p>
              <div className="two-actions">
                <button className="button" onClick={() => answer('decline')}>
                  Decline
                </button>
                <button className="button lime" onClick={() => answer('accept')}>
                  Accept
                </button>
              </div>
            </div>
          )}
          {user.connection === 'pending' && (
            <p className="hint">Message request sent. You can send more once {first} accepts or replies.</p>
          )}
          {!user.connection && (
            <p className="hint">You’re not connected yet: your first message goes to {first} as a request.</p>
          )}
          <Chat key={id} path={'/messages/with/' + id} onSent={reload} />
        </>
      )}
    </>
  )
}

// Messages: private chats, your groups' and crews' chats, and requests from people you're not connected to.
export default function Messages() {
  const [params, setParams] = useSearchParams()
  const tab = ['Groups', 'Requests'].includes(params.get('view') || '') ? params.get('view')! : 'Chats'
  const chat = params.get('chat')
  const list = useApi<Conversations>(chat ? null : '/messages')
  const connections = useApi<{ incoming: Person[] }>(chat ? null : '/connections')
  if (chat) return <PrivateChat id={chat} />
  const incoming = connections.data?.incoming || []
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
        values={['Chats', 'Groups', incoming.length ? `Requests · ${incoming.length}` : 'Requests']}
        value={tab === 'Requests' && incoming.length ? `Requests · ${incoming.length}` : tab}
        onChange={(view) => setParams({ view: view.split(' ')[0] }, { replace: true })}
      />
      {tab === 'Requests' && (
        <div className="stack">
          {incoming.map((user) => (
            <article className="notice lilac" key={user.id}>
              <Link className="member-row" to={'/users/' + user.id}>
                <Avatar id={user.id} name={user.name} />
                <span>
                  <strong>{user.name}</strong>
                  <small>{user.city ? user.city + ' · ' : ''}see profile →</small>
                </span>
              </Link>
              <p>{user.message ? `“${user.message}”` : 'Wants to connect with you.'}</p>
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
          {connections.data && !incoming.length && <Empty>No message requests.</Empty>}
        </div>
      )}
      {tab === 'Chats' && (
        <div className="stack">
          {list.data?.people.map((p) => (
            <Link className="conversation lilac person-chat" key={p.id} to={'?chat=' + p.id}>
              <Avatar id={p.id} name={p.name} />
              <div>
                <h2>{p.name}</h2>
                <p>{p.status === 'pending' ? 'Request sent · waiting for a reply' : p.last || 'Say hello'}</p>
              </div>
            </Link>
          ))}
          {list.data && !list.data.people.length && (
            <Empty>
              No chats yet. Open anyone’s profile and tap Message to say hi.
              <Link className="button" to="/">
                Find people →
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
      {tab === 'Groups' && (
        <div className="stack">
          {list.data?.groups.map((g) => (
            <Link key={g.id} className={'conversation ' + g.color} to={'/groups/' + g.id + '?tab=Chat'}>
              <div>
                <h2>{g.name}</h2>
                <p>{g.last || 'No messages yet · say hi'} →</p>
              </div>
            </Link>
          ))}
          {list.data && !list.data.groups.length && (
            <Empty>
              No group chats yet.
              <Link className="button" to="/">
                Find a group or event →
              </Link>
            </Empty>
          )}
        </div>
      )}
    </>
  )
}
