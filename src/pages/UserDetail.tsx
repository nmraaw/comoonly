import { Link, useParams } from 'react-router-dom'
import type { User } from '../types'
import { useApp } from '../state/AppContext'
import { useApi } from '../api'
import Profile from '../components/Profile'
import NotFound from '../components/NotFound'
import DetailHeader from '../components/DetailHeader'
import { Empty } from '../components/UI'
type PublicProfile = User & { groups: { id: string; name: string }[] }
export default function UserDetail() {
  const { id } = useParams()
  const { me } = useApp()
  const { data: user, error, reload } = useApi<PublicProfile>('/users/' + encodeURIComponent(id!))
  if (error) return <NotFound type="Profile" />
  if (!user) return <Empty>Loading…</Empty>
  return (
    <>
      <DetailHeader title={user.name + '’s corner'} fallback="/" />
      <Profile user={user} own={user.id === me!.id} onChange={reload} />
      <h2 className="section-title">My circles</h2>
      <div className="stack">
        {user.groups.map((g) => (
          <Link key={g.id} className="conversation" to={'/groups/' + g.id}>
            <strong>{g.name}</strong>
            <span>↗</span>
          </Link>
        ))}
        {!user.groups.length && <Empty>No circles yet.</Empty>}
      </div>
    </>
  )
}
