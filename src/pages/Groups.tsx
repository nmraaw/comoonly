import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { Chips, Empty, Mascot } from '../components/UI'
import type { Group } from '../types'
export default function Groups() {
  const { me, groups, membership } = useApp()
  const [params, setParams] = useSearchParams()
  const id = params.get('group')
  const view = params.get('view') === 'requests' ? 'Requests' : 'Active'
  const count = (status: string) => Object.values(membership).filter((s) => s === status).length
  const people = (n: number) => `${n} ${n === 1 ? 'person' : 'people'}`
  const mine = groups.filter((g) => membership[g.id] === (view === 'Active' ? 'joined' : 'pending'))
  // In Active, an event's everyone-going group and your crew for it share one card (keyed by the event).
  const listed: { g: Group; crews: Group[] }[] = []
  for (const g of mine) {
    let card = view === 'Active' && g.eventId ? listed.find((l) => l.g.eventId === g.eventId) : undefined
    if (!card) listed.push((card = { g, crews: [] }))
    if (g.crewFor) card.crews.push(g)
    else card.g = g // the everyone-going group leads the card
  }
  if (id)
    return (
      <Navigate
        replace
        to={
          '/groups/' +
          encodeURIComponent(id) +
          (params.get('tab') ? '?tab=' + encodeURIComponent(params.get('tab')!) : '')
        }
      />
    )
  return (
    <>
      <header className="page-top">
        <strong>Your little circles</strong>
        <Link className="icon-button" aria-label="Create group" to="/create">
          ＋
        </Link>
      </header>
      <h1>
        Good things
        <br />
        are a group thing.
      </h1>
      {/* Tab labels show counts, like "Active · 3", as in the Figma design. */}
      <Chips
        label="Your groups"
        values={[`Active · ${count('joined')}`, `Requests · ${count('pending')}`]}
        value={`${view} · ${count(view === 'Active' ? 'joined' : 'pending')}`}
        onChange={(v) => setParams(v.startsWith('Requests') ? { view: 'requests' } : {}, { replace: true })}
      />
      <div className="stack">
        {listed.map(({ g, crews }, i) =>
          g.eventId && view === 'Active' ? (
            // An event: its everyone-going chat and your crew in one card.
            <article key={g.eventId} className={'activity-card group-art ' + g.color}>
              {i === 0 && <Mascot name="reel" />}
              <small>Event</small>
              <h2>{g.eventTitle}</h2>
              {!g.crewFor && (
                <Link className="event-row" to={'/groups/' + g.id + '?tab=Chat'}>
                  💬 <strong>General chat</strong> · {people(g.members)} →
                </Link>
              )}
              {crews.map((c) => (
                <Link className="event-row" key={c.id} to={'/groups/' + c.id}>
                  👥 <strong>{c.ownerId === me!.id ? 'Your crew' : c.owner.split(' ')[0] + '’s crew'}</strong> ·{' '}
                  {c.members} of {c.members + c.spots} →
                </Link>
              ))}
              <Link className="button primary" to={'/events/' + g.eventId}>
                See event →
              </Link>
            </article>
          ) : (
            <article key={g.id} className={'activity-card group-art ' + g.color}>
              {i === 0 && view === 'Active' && <Mascot name="reel" />}
              <h2>{g.name}</h2>
              <p>
                {view === 'Active'
                  ? people(g.members) + ' · Your little circle'
                  : 'A hello in progress. Your request is pending.'}
              </p>
              {view === 'Active' ? (
                <Link className="button primary" to={'/groups/' + g.id}>
                  Open group →
                </Link>
              ) : (
                <Link className="button primary" to={'/posts/' + g.id}>
                  View invitation →
                </Link>
              )}
            </article>
          ),
        )}
        {!listed.length && (
          <Empty>
            {view === 'Active' ? 'Your people are out there.' : 'No pending requests.'}
            <Link className="button" to="/">
              Find a group →
            </Link>
          </Empty>
        )}
      </div>
    </>
  )
}
