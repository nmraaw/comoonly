import { useEffect, useState } from 'react'
import { api } from '../api'
import { Chips, Logo } from '../components/UI'
import type { Me } from '../types'
import Dashboard from './Dashboard'
import ReviewEvents from './ReviewEvents'

// The admin interface: its own page (/admin/), its own login, and its own code bundle, so none of it
// ships inside the public app. The server still checks every admin request (requireAdmin), so a
// non-admin who finds this page can't load or change anything.
export default function AdminApp() {
  const [me, setMe] = useState<Me | null | undefined>(undefined)
  const [tab, setTab] = useState('Dashboard')
  const [error, setError] = useState('')

  useEffect(() => {
    api<Me>('/auth/me').then(setMe, () => setMe(null))
  }, [])

  async function login(form: HTMLFormElement) {
    setError('')
    try {
      setMe(await api<Me>('/auth/login', { method: 'POST', body: Object.fromEntries(new FormData(form)) }))
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function logout() {
    await api('/auth/logout', { method: 'POST' })
    setMe(null)
  }

  if (me === undefined) return null // checking the session

  return (
    <div className="admin-shell">
      <header className="page-top">
        <span className="admin-brand">
          <Logo /> <strong>admin</strong>
        </span>
        {me && (
          <button className="text-button" onClick={logout}>
            Log out
          </button>
        )}
      </header>

      {!me && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            login(e.currentTarget)
          }}
        >
          <h1>Admin log in</h1>
          <label>
            Email
            <input name="email" type="email" required autoComplete="email" />
          </label>
          <label>
            Password
            <input name="password" type="password" required autoComplete="current-password" />
          </label>
          {error && (
            <p className="notice pink" role="alert">
              {error}
            </p>
          )}
          <button className="button primary">Log in →</button>
        </form>
      )}

      {me && !me.isAdmin && (
        <div className="notice pink" role="alert">
          <strong>This account isn’t an admin.</strong>
          <p>Admins are the emails listed in ADMIN_EMAILS on the server. Log out and use that account.</p>
        </div>
      )}

      {me?.isAdmin && (
        <>
          <Chips label="Admin section" values={['Dashboard', 'Review events']} value={tab} onChange={setTab} />
          {tab === 'Dashboard' ? <Dashboard me={me} onReview={() => setTab('Review events')} /> : <ReviewEvents />}
        </>
      )}
    </div>
  )
}
