import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { Chips, Empty, Mascot } from '../components/UI'
export default function Groups() {
  const { groups, membership } = useApp()
  const [params, setParams] = useSearchParams()
  const id = params.get('group')
  const view = params.get('view') === 'requests' ? 'Requests' : 'Active'
  const count = (status: string) => Object.values(membership).filter((s) => s === status).length
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
        onChange={(v) => setParams(v.startsWith('Requests') ? { view: 'requests' } : {})}
      />
      <div className="stack">
        {groups
          .filter((g) => membership[g.id] === (view === 'Active' ? 'joined' : 'pending'))
          .map((g, i) => (
            <article key={g.id} className={'activity-card group-art ' + g.color}>
              {i === 0 && view === 'Active' && <Mascot name="reel" />}
              <h2>{g.name}</h2>
              <p>
                {view === 'Active'
                  ? g.members + ' members · Your little circle'
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
          ))}
        {!groups.some((g) => membership[g.id] === (view === 'Active' ? 'joined' : 'pending')) && (
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
