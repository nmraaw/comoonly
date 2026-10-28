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
  const match = useApi<{ waiting: boolean; total: number }>('/events/' + encodeURIComponent(id!) + '/match')
  const [onlyWomen, setOnlyWomen] = useState(false)
  const going = useApi<{ locked: boolean; count?: number; people?: { id: string; name: string }[] }>(
    '/events/' + encodeURIComponent(id!) + '/going',
  )
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
      match.reload()
      going.reload()
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
            <p className="hint">Nobody from Comoonly has to go alone.</p>
            {/* Who's going unlocks once you say you're going too (the server keeps it locked). */}
            {going.data && (
              <div className="gt-card">
                <div className="gt-row">
                  {going.data.locked ? (
                    <div className="avatar-stack locked" aria-hidden="true">
                      {Array.from({ length: Math.max(1, Math.min(going.data.count!, 4)) }, (_, i) => (
                        <span className="avatar" key={i} />
                      ))}
                    </div>
                  ) : (
                    <div className="avatar-stack">
                      {going.data.people!.slice(0, 4).map((p) => (
                        <Link key={p.id} to={'/users/' + p.id} aria-label={p.name}>
                          <Avatar id={p.id} name={p.name} />
                        </Link>
                      ))}
                      {!going.data.people!.length && <span className="gt-icon">👋</span>}
                    </div>
                  )}
                  <div className="gt-text">
                    {going.data.locked ? (
                      <>
                        <strong>
                          {going.data.count ? `${going.data.count} from Comoonly going` : 'Nobody from Comoonly yet'}
                        </strong>
                        <small>{going.data.count ? 'Tap “I want to go” to see who' : 'Be the first to go'}</small>
                      </>
                    ) : going.data.people!.length ? (
                      <>
                        <strong>{going.data.people!.length} from Comoonly going</strong>
                        <small>
                          {going.data
                            .people!.slice(0, 3)
                            .map((p) => p.name.split(' ')[0])
                            .join(', ')}
                          {going.data.people!.length > 3 && ` and ${going.data.people!.length - 3} more`}
                        </small>
                      </>
                    ) : (
                      <>
                        <strong>You’re the first one going</strong>
                        <small>Others will see you here</small>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
            <div className="gt-card">
              <div className="gt-row">
                <span className="gt-icon">💬</span>
                <div className="gt-text">
                  <strong>General chat</strong>
                  <small>
                    {intent && intent.value !== 'friends' && e.groupId
                      ? 'Everyone from Comoonly at this event'
                      : 'Opens when you tap “I want to go”'}
                  </small>
                </div>
                {intent && intent.value !== 'friends' && e.groupId && (
                  <Link className="gt-action" to={'/groups/' + e.groupId + '?tab=Chat'}>
                    Open
                  </Link>
                )}
              </div>
            </div>

            <h2 className="section-title">Crews</h2>
            <p className="hint">2 to 5 people who meet first and arrive together. The organizer says who joins.</p>
            {!me!.verified && (
              <Link className="gt-card gt-row" to="/me/edit">
                <span className="gt-icon">✓</span>
                <span className="gt-text">
                  <strong>Get verified to join crews</strong>
                  <small>Finish your profile, it takes a minute</small>
                </span>
                <span className="gt-action">Go</span>
              </Link>
            )}
            {me!.verified && crews.data && !crews.data.some((c) => c.myStatus) && (
              // "Find me a crew": Comoonly picks the people you have most in common with (events.going.ts).
              <div className="gt-card match">
                <div className="gt-row">
                  <span className="gt-icon">✨</span>
                  <div className="gt-text" role={match.data?.waiting ? 'status' : undefined}>
                    <strong>{match.data?.waiting ? 'Finding your crew…' : 'Find me a crew'}</strong>
                    <small>
                      {match.data?.waiting
                        ? `${match.data.total} ${match.data.total === 1 ? 'person' : 'people'} waiting. We’ll tell you when it’s ready.`
                        : 'We match you with people who share your interests'}
                    </small>
                  </div>
                </div>
                {match.data?.waiting ? (
                  <button className="text-button" onClick={() => send('/events/' + e.id + '/match', 'DELETE')}>
                    Stop matching
                  </button>
                ) : (
                  <>
                    {me!.gender === 'woman' && (
                      <label className="check-row">
                        <input type="checkbox" checked={onlyWomen} onChange={(x) => setOnlyWomen(x.target.checked)} />{' '}
                        Only with women
                      </label>
                    )}
                    <button
                      className="button primary"
                      onClick={() => send('/events/' + e.id + '/match', 'POST', { womenOnly: onlyWomen })}
                    >
                      Find me a crew →
                    </button>
                  </>
                )}
              </div>
            )}
            {crews.data?.map((c) => (
              <div className="gt-card" key={c.id}>
                <Link className="gt-row" to={'/users/' + c.ownerId}>
                  <Avatar id={c.ownerId} name={c.owner} />
                  <span className="gt-text">
                    <strong>{c.ownerId === me!.id ? 'Your crew' : `${c.owner.split(' ')[0]}’s crew`}</strong>
                    <small>
                      {c.members} of {c.size} going{c.area ? ` · from ${c.area}` : ''}
                    </small>
                  </span>
                  {c.womenOnly && <span className="pill">👩 Women only</span>}
                </Link>
                <p className="gt-plan">📍 {c.plan}</p>
                {c.myStatus === 'joined' ? (
                  <Link className="button" to={'/groups/' + c.id}>
                    You’re in · Open crew →
                  </Link>
                ) : c.myStatus === 'pending' ? (
                  <small className="gt-plan">Asked to join. {c.owner.split(' ')[0]} will reply.</small>
                ) : c.members >= c.size ? (
                  <small className="gt-plan">This crew is full.</small>
                ) : (
                  me!.verified && (
                    <button className="button" onClick={() => setJoining(c)}>
                      Ask to join
                    </button>
                  )
                )}
              </div>
            ))}
            {me!.verified && !crews.data?.some((c) => c.ownerId === me!.id) && (
              <button className="text-button" onClick={() => setStarting(true)}>
                ＋ Or start your own crew
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
