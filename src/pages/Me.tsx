import { Link } from 'react-router-dom'
import Profile from '../components/Profile'
import { Empty } from '../components/UI'
import { useApp } from '../state/AppContext'
export default function Me() {
  const { me, groups, membership, logout } = useApp()
  const mine = groups.filter((g) => membership[g.id] === 'joined')
  return (
    <>
      <header className="page-top">
        <strong>Your corner</strong>
        <Link className="text-button" to="/me/edit">
          Edit profile
        </Link>
      </header>
      <Profile own />
      {me!.isAdmin && (
        <Link className="button primary" to="/admin">
          Your dashboard →
        </Link>
      )}
      <h2 className="section-title">My circles</h2>
      <div className="stack">
        {mine.map((g) => (
          <Link className="conversation" key={g.id} to={'/groups/' + g.id}>
            <strong>{g.name}</strong>
            <span>↗</span>
          </Link>
        ))}
        {!mine.length && (
          <Empty>
            No circles yet.
            <Link className="button" to="/">
              Find a group →
            </Link>
          </Empty>
        )}
      </div>
      <button className="button" onClick={() => logout()}>
        Log out
      </button>
    </>
  )
}
