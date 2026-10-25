import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import Profile from '../components/Profile'
import { Empty, Modal } from '../components/UI'
import { useApp } from '../state/AppContext'
export default function Me() {
  const { me, groups, membership, logout } = useApp()
  const mine = groups.filter((g) => membership[g.id] === 'joined')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  async function deleteAccount(form: HTMLFormElement) {
    setError('')
    try {
      await api('/auth/me', { method: 'DELETE', body: { password: new FormData(form).get('password') } })
      window.location.assign('/') // start over on the welcome screen
    } catch (err) {
      setError((err as Error).message)
    }
  }
  return (
    <>
      <header className="page-top">
        <strong>Your corner</strong>
        <Link className="text-button" to="/me/edit">
          Edit profile
        </Link>
      </header>
      <Profile own />
      {!me!.verified && (
        <Link className="notice pink" to="/me/edit">
          <strong>Get ✓ Verified</strong> to go to events in a crew: add your city, gender, a line about you and
          interests →
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
      <div className="two-actions">
        <Link className="text-button" to="/privacy">
          Privacy &amp; guidelines
        </Link>
        <button className="text-button" onClick={() => setDeleting(true)}>
          Delete my account
        </button>
      </div>
      {deleting && (
        <Modal title="Delete your account?" onClose={() => setDeleting(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              deleteAccount(e.currentTarget)
            }}
          >
            <p>
              This removes your profile, messages and memberships, and the groups you host, for good. It can’t be
              undone.
            </p>
            <label>
              Your password
              <input name="password" type="password" required autoComplete="current-password" />
            </label>
            {error && (
              <p className="notice pink" role="alert">
                {error}
              </p>
            )}
            <button className="button primary">Delete everything</button>
          </form>
        </Modal>
      )}
    </>
  )
}
