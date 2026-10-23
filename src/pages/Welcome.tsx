import { useState } from 'react'
import { useApp } from '../state/AppContext'
import type { Me } from '../types'
import { api } from '../api'
import { Logo, Mascot } from '../components/UI'

// Shown to anyone who isn't logged in, whatever page they opened. Matches "01 · Welcome" in Figma:
// first a friendly intro with two choices, then the sign-up or log-in form.
export default function Welcome() {
  const { signIn } = useApp()
  const [mode, setMode] = useState<'intro' | 'signup' | 'login'>('intro')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const signup = mode === 'signup'

  async function submit(form: HTMLFormElement) {
    setBusy(true)
    setError('')
    try {
      const body = Object.fromEntries(new FormData(form))
      signIn(await api<Me>(signup ? '/auth/signup' : '/auth/login', { method: 'POST', body }))
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  if (mode === 'intro') {
    return (
      <>
        <header className="page-top">
          <Logo />
        </header>
        <div className="welcome-art">
          <Mascot name="pip" />
          <Mascot name="loop" />
        </div>
        <span className="pill">YOUR PEOPLE ARE HERE</span>
        <h1>
          Big on interests.
          <br />
          Better together.
        </h1>
        <p>Find a few people for the things you keep saying you’ll do someday.</p>
        <button className="button lime" onClick={() => setMode('signup')}>
          Find my people →
        </button>
        <button className="button" onClick={() => setMode('login')}>
          I already have an account
        </button>
      </>
    )
  }

  return (
    <>
      <header className="page-top">
        <button className="icon-button" aria-label="Back" onClick={() => setMode('intro')}>
          ←
        </button>
        <strong>{signup ? 'Create your account' : 'Log in'}</strong>
      </header>
      <h1>
        {signup ? (
          <>
            Nice to meet
            <br />
            you.
          </>
        ) : (
          <>
            Good to see
            <br />
            you again.
          </>
        )}
      </h1>
      <form key={mode} onSubmit={(e) => (e.preventDefault(), submit(e.currentTarget))}>
        {signup && (
          <label>
            Your name
            <input name="name" required maxLength={60} autoComplete="name" />
          </label>
        )}
        <label>
          Email
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            required
            minLength={signup ? 8 : undefined}
            maxLength={100}
            autoComplete={signup ? 'new-password' : 'current-password'}
          />
        </label>
        {signup && <p className="hint">At least 8 characters.</p>}
        {error && (
          <p className="notice pink" role="alert">
            {error}
          </p>
        )}
        <button className="button primary" disabled={busy}>
          {busy ? 'One moment…' : signup ? 'Create account →' : 'Log in →'}
        </button>
      </form>
      <button className="text-button" onClick={() => setMode(signup ? 'login' : 'signup')}>
        {signup ? 'I already have an account' : 'New here? Create an account'}
      </button>
    </>
  )
}
