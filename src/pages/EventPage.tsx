import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { api, useApi } from '../api'
import type { Crew, EventItem, Intent } from '../types'
import { eventCalendar } from '../events'
import DetailHeader from '../components/DetailHeader'
import EventDetails from '../components/EventDetails'
import NotFound from '../components/NotFound'
import { CalendarPopup } from '../components/AddToCalendar'
import { Avatar, Empty, Modal } from '../components/UI'

const INTENTS: { value: Intent; title: string; text: string }[] = [
  {
    value: 'company',
    title: '🙋 Looking for company',
    text: 'I’d go if someone came with me. Join the group chat and find a crew.',
  },
  { value: 'meet', title: '👋 Happy to meet people there', text: 'I’m going anyway. Say hi in the group chat.' },
  { value: 'friends', title: '👯 Going with my friends', text: 'Just keep it on my list. No group chat.' },
]

// One event: what it is first; going together (how you're going, crews, the group chat) after.
export default function EventPage() {
  const { id } = useParams()
  const { me, refresh } = useApp()
  const event = useApi<EventItem>('/events/' + encodeURIComponent(id!))
  const crews = useApi<Crew[]>('/events/' + encodeURIComponent(id!) + '/crews')
  const [choosing, setChoosing] = useState(false)
  const [starting, setStarting] = useState(false)
  const [joining, setJoining] = useState<Crew>()
  const [asking, setAsking] = useState(false) // just said "I want to go": offer the calendar
  const [error, setError] = useState('')
  if (event.error) return <NotFound type="Event" to="/events" />
  const e = event.data
  if (!e) return <Empty>Loading…</Empty>
  const intent = INTENTS.find((i) => i.value === e.myIntent)

  // Every change goes to the server, then the page reloads what it shows.
  async function send(path: string, method: string, body?: unknown) {
    setError('')
    try {
      await api(path, { method, body })
      await refresh()
      event.reload()
      crews.reload()
      return true
    } catch (err) {
      setError((err as Error).message)
      return false
    }
  }
  async function go(value: Intent) {
    if (await send('/events/' + e!.id + '/go', 'POST', { intent: value })) {
      setChoosing(false)
      if (!e!.myIntent) setAsking(true)
    }
  }
  async function startCrew(form: HTMLFormElement) {
    const data = new FormData(form)
    const ok = await send('/events/' + e!.id + '/crews', 'POST', {
      size: Number(data.get('size')),
      plan: data.get('plan'),
      area: data.get('area'),
      womenOnly: data.get('womenOnly') === 'on',
    })
    if (ok) setStarting(false)
  }
  async function askToJoin(form: HTMLFormElement) {
    const ok = await send('/groups/' + joining!.id + '/requests', 'POST', { intro: new FormData(form).get('intro') })
    if (ok) setJoining(undefined)
  }

  return (
    <>
      <DetailHeader title="Event" fallback="/events" />
      <EventDetails
        event={e}
        after={
          <>
            <h2 className="section-title">Go together</h2>
            <div className="notice info-rows">
              <p>
                <strong>💬 General chat</strong> · one big group chat for everyone from Comoonly at this event. Say hi,
                ask questions, find people.
              </p>
              {intent && intent.value !== 'friends' && e.groupId ? (
                <Link className="button primary" to={'/groups/' + e.groupId + '?tab=Chat'}>
                  Open the group chat →
                </Link>
              ) : (
                <small>Open to anyone going who’s looking for company or happy to meet people.</small>
              )}
            </div>
            <h2 className="section-title">Crews</h2>
            <p>
              <strong>A crew is 2 to 5 people</strong> who meet up first and arrive together. The organizer says yes to
              who joins.
            </p>
            {!me!.verified && (
              <Link className="notice pink" to="/me/edit">
                <strong>Get ✓ Verified</strong> to start or join a crew: finish your profile →
              </Link>
            )}
            {crews.data?.map((c) => (
              <article className="notice lilac" key={c.id}>
                <Link className="member-row" to={'/users/' + c.ownerId}>
                  <Avatar id={c.ownerId} name={c.owner} />
                  <span>
                    <strong>{c.ownerId === me!.id ? 'Your crew' : `${c.owner.split(' ')[0]}’s crew`}</strong>
                    <small>Organized by {c.ownerId === me!.id ? 'you' : c.owner} · see profile →</small>
                  </span>
                  {c.womenOnly && <span className="pill">👩 Women only</span>}
                </Link>
                <p>
                  📍 <strong>{c.plan}</strong>
                </p>
                <small>
                  {c.members} of {c.size} going together{c.area ? ` · coming from ${c.area}` : ''}
                </small>
                {c.myStatus === 'joined' ? (
                  <Link className="button" to={'/groups/' + c.id}>
                    You’re in · Open crew →
                  </Link>
                ) : c.myStatus === 'pending' ? (
                  <p className="hint">Asked to join. {c.owner.split(' ')[0]} will reply.</p>
                ) : c.members >= c.size ? (
                  <p className="hint">This crew is full.</p>
                ) : (
                  me!.verified && (
                    <button className="button" onClick={() => setJoining(c)}>
                      Ask to join
                    </button>
                  )
                )}
              </article>
            ))}
            {crews.data && !crews.data.length && <p className="hint">No crews yet. Start the first one!</p>}
            {me!.verified && !crews.data?.some((c) => c.ownerId === me!.id) && (
              <button className="button lime" onClick={() => setStarting(true)}>
                ＋ Start a crew
              </button>
            )}
          </>
        }
      >
        {intent ? (
          <>
            <div className="notice mint">
              <p>
                <strong>✓ You’re going · {intent.title}</strong>
              </p>
              <button className="text-button" onClick={() => setChoosing(true)}>
                Change
              </button>
            </div>
          </>
        ) : (
          <button className="button primary" onClick={() => setChoosing(true)}>
            I want to go →
          </button>
        )}
      </EventDetails>

      {choosing && (
        <Modal title="How are you going?" onClose={() => setChoosing(false)}>
          {INTENTS.map((i) => (
            <button
              key={i.value}
              className={'notice choice ' + (e.myIntent === i.value ? 'mint' : '')}
              onClick={() => go(i.value)}
            >
              <strong>{i.title}</strong>
              <small>{i.text}</small>
            </button>
          ))}
          {error && <p className="notice pink">{error}</p>}
          {e.myIntent && (
            <button
              className="text-button"
              onClick={() => send('/events/' + e.id + '/go', 'DELETE').then((ok) => ok && setChoosing(false))}
            >
              I’m not going any more
            </button>
          )}
        </Modal>
      )}

      {starting && (
        <Modal title="Start a crew" onClose={() => setStarting(false)}>
          <form onSubmit={(ev) => (ev.preventDefault(), startCrew(ev.currentTarget))}>
            <label>
              Where and when will you meet?
              <input name="plan" required maxLength={200} placeholder="Outside the main gate, 15 min before" />
            </label>
            <label>
              How many people in total, with you?
              <select name="size" defaultValue="4">
                {[2, 3, 4, 5].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <label>
              Coming from (optional)
              <input name="area" maxLength={80} placeholder="Gulshan, DHA, Model Town…" />
            </label>
            {me!.gender === 'woman' && (
              <label className="check-row">
                <input type="checkbox" name="womenOnly" defaultChecked /> 👩 Women only
              </label>
            )}
            <p className="hint">You’ll be the organizer: people ask to join, and you say yes or no.</p>
            {error && <p className="notice pink">{error}</p>}
            <button className="button lime">Start crew →</button>
          </form>
        </Modal>
      )}

      {joining && (
        <Modal title={`Join ${joining.owner.split(' ')[0]}’s crew`} onClose={() => setJoining(undefined)}>
          <form onSubmit={(ev) => (ev.preventDefault(), askToJoin(ev.currentTarget))}>
            <label>
              Say hi to {joining.owner.split(' ')[0]}
              <textarea name="intro" required maxLength={300} placeholder="Hi! First time going, would love company." />
            </label>
            <label className="check-row">
              <input type="checkbox" required /> I’ll be kind, on time, and meet in a public place.
            </label>
            {error && <p className="notice pink">{error}</p>}
            <button className="button primary">Ask to join →</button>
          </form>
        </Modal>
      )}

      {asking && <CalendarPopup {...eventCalendar(e)} onClose={() => setAsking(false)} />}
    </>
  )
}
