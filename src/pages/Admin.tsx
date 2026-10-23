import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, useApi } from '../api'
import { useApp } from '../state/AppContext'
import DetailHeader from '../components/DetailHeader'
import NotFound from '../components/NotFound'
import { Chips, Empty } from '../components/UI'
type Overview = {
  totals: {
    people: number
    newThisWeek: number
    groups: number
    published: number
    drafts: number
    openReports: number
  }
  people: { id: string; name: string; email: string; city: string; joinedAt: number; groups: number }[]
  events: {
    id: string
    title: string
    date: string
    city: string
    status: string
    registerUrl: string
    going: number
  }[]
  reports: {
    id: string
    reason: string
    details: string
    status: string
    createdAt: number
    reportedId: string
    reportedName: string
    reporterName: string
  }[]
}
const day = (time: number | string) =>
  new Date(time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
// Your dashboard: who signed up, which events exist, and what people reported. Only admins can open it;
// the server checks too, so nobody else can load this data even by typing the address.
export default function Admin() {
  const { me } = useApp()
  const { data, error, reload } = useApi<Overview>(me!.isAdmin ? '/admin/overview' : null)
  const [tab, setTab] = useState('People')
  const [search, setSearch] = useState('')
  if (!me!.isAdmin) return <NotFound />
  async function resolve(id: string) {
    try {
      await api('/admin/reports/' + id + '/resolve', { method: 'POST' })
    } catch (err) {
      alert((err as Error).message)
    }
    reload()
  }
  // For data-deletion requests sent to the contact email on the privacy page.
  async function deletePerson(id: string, name: string) {
    if (!confirm(`Delete ${name}'s account and all their data? This can't be undone.`)) return
    try {
      await api('/admin/users/' + id, { method: 'DELETE' })
    } catch (err) {
      alert((err as Error).message)
    }
    reload()
  }
  const t = data?.totals
  const q = search.toLowerCase()
  return (
    <>
      <DetailHeader title="Dashboard" fallback="/me" />
      <h1>
        How Comoonly
        <br />
        is doing.
      </h1>
      {error && <Empty>{error}</Empty>}
      {t && (
        <div className="stat-grid">
          {[
            ['People', t.people],
            ['New this week', t.newThisWeek],
            ['Groups', t.groups],
            ['Live events', t.published],
            ['To review', t.drafts],
            ['Open reports', t.openReports],
          ].map(([label, value]) => (
            <div className="stat" key={label}>
              <strong>{value}</strong>
              <small>{label}</small>
            </div>
          ))}
        </div>
      )}
      {t && t.drafts > 0 && (
        <Link className="button" to="/events/review">
          Review {t.drafts} new events →
        </Link>
      )}
      {/* A full copy of the database: keep it somewhere private, it holds everyone's data. */}
      <a className="button" href="/api/admin/backup" download>
        Download a backup
      </a>
      <Chips label="Dashboard section" values={['People', 'Events', 'Reports']} value={tab} onChange={setTab} />
      {tab !== 'Reports' && (
        <label className="search">
          <input
            aria-label={'Search ' + tab.toLowerCase()}
            placeholder={'Search ' + tab.toLowerCase() + '…'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      )}
      <div className="stack">
        {tab === 'People' &&
          data?.people
            .filter((p) => (p.name + ' ' + p.email + ' ' + p.city).toLowerCase().includes(q))
            .map((p) => (
              <div className="member-row" key={p.id}>
                <Link to={'/users/' + p.id}>
                  <strong>{p.name}</strong>
                  <small>
                    {p.email}
                    {p.city ? ' · ' + p.city : ''} · joined {day(p.joinedAt)} · {p.groups}{' '}
                    {p.groups === 1 ? 'group' : 'groups'}
                  </small>
                </Link>
                {p.id !== me!.id && (
                  <button className="text-button" onClick={() => deletePerson(p.id, p.name)}>
                    Delete
                  </button>
                )}
              </div>
            ))}
        {tab === 'Events' &&
          data?.events
            .filter((e) => (e.title + ' ' + e.city + ' ' + e.status).toLowerCase().includes(q))
            .map((e) => (
              <a className="member-row" key={e.id} href={e.registerUrl} target="_blank" rel="noopener noreferrer">
                <span>
                  <strong>{e.title}</strong>
                  <small>
                    {e.status} · {day(e.date)}
                    {e.city ? ' · ' + e.city : ''} · {e.going} going together
                  </small>
                </span>
              </a>
            ))}
        {tab === 'Reports' && (
          <>
            {data && !data.reports.length && <Empty>No reports. Nice.</Empty>}
            {data?.reports.map((r) => (
              <article className={'notice ' + (r.status === 'open' ? 'pink' : '')} key={r.id}>
                <strong>{r.reason}</strong>
                <p>
                  <Link className="text-button" to={'/users/' + r.reportedId}>
                    {r.reportedName}
                  </Link>
                  , reported by {r.reporterName} · {day(r.createdAt)}
                </p>
                {r.details && <p>{r.details}</p>}
                {r.status === 'open' ? (
                  <button className="button" onClick={() => resolve(r.id)}>
                    Mark as handled
                  </button>
                ) : (
                  <p>Handled</p>
                )}
              </article>
            ))}
          </>
        )}
      </div>
    </>
  )
}
