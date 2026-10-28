import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import type { Me } from '../types'
import { api } from '../api'
import { Logo, Mascot } from '../components/UI'

// Shown to anyone who isn't logged in, whatever page they opened. Matches "01 · Welcome" in Figma:
// first a friendly intro with two choices, then the sign-up or log-in form.
export default function Welcome() {
  const { signIn } = useApp()
  const [mode, setMode] = useState<'intro' | 'signup' | 'login' | 'forgot'>('intro')
  const [resetEmail, setResetEmail] = useState('') // forgot password: the code was sent to this address
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // After sign-up (or logging in before ever entering the code): the form's details, kept to send with the code.
  const [pending, setPending] = useState<Record<string, FormDataEntryValue>>()
  const signup = mode === 'signup'

  async function send(path: string, body: Record<string, FormDataEntryValue>) {
    setBusy(true)
    setError('')
    try {
      const result = await api<Me | { needsCode: true }>(path, { method: 'POST', body })
      if ('needsCode' in result) setPending(body)
      else signIn(result)
    } catch (err) {
      setError((err as Error).message)
    }
    setBusy(false)
  }
  const submit = (form: HTMLFormElement) =>
    send(signup ? '/auth/signup' : '/auth/login', Object.fromEntries(new FormData(form)))

  // Forgot password: first the email (a code is sent), then the code and a new password.
  async function forgot(email: string) {
    setBusy(true)
    setError('')
    try {
      await api('/auth/forgot', { method: 'POST', body: { email } })
      setResetEmail(email)
    } catch (err) {
      setError((err as Error).message)
    }
    setBusy(false)
  }
  if (mode === 'forgot') {
    return (
      <>
        <header className="page-top">
          <button
            className="icon-button"
            aria-label="Back"
            onClick={() => (setMode('login'), setResetEmail(''), setError(''))}
          >
            ←
          </button>
          <strong>New password</strong>
        </header>
        <h1>
          Happens to
          <br />
          everyone.
        </h1>
        {!resetEmail ? (
          <form onSubmit={(e) => (e.preventDefault(), forgot(String(new FormData(e.currentTarget).get('email'))))}>
            <p>Enter your email and we’ll send you a 6-digit code.</p>
            <label>
              Email
              <input name="email" type="email" required autoComplete="email" />
            </label>
            {error && (
              <p className="notice pink" role="alert">
                {error}
              </p>
            )}
            <button className="button primary" disabled={busy}>
              {busy ? 'One moment…' : 'Send me a code →'}
            </button>
          </form>
        ) : (
          <>
            <p>
              If <strong>{resetEmail}</strong> has an account, a 6-digit code is on its way. It can take a minute; check
              spam too.
            </p>
            <form
              onSubmit={(e) => (
                e.preventDefault(),
                send('/auth/reset', { email: resetEmail, ...Object.fromEntries(new FormData(e.currentTarget)) })
              )}
            >
              <label>
                Code
                <input
                  name="code"
                  required
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  autoComplete="one-time-code"
                />
              </label>
              <label>
                New password
                <input
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  maxLength={100}
                  autoComplete="new-password"
                />
              </label>
              <p className="hint">At least 8 characters. You’ll be logged out everywhere else.</p>
              {error && (
                <p className="notice pink" role="alert">
                  {error}
                </p>
              )}
              <button className="button primary" disabled={busy}>
                {busy ? 'One moment…' : 'Save new password →'}
              </button>
            </form>
            <button className="text-button" disabled={busy} onClick={() => forgot(resetEmail)}>
              Send a new code
            </button>
          </>
        )}
      </>
    )
  }

  if (pending) {
    return (
      <>
        <header className="page-top">
          <button className="icon-button" aria-label="Back" onClick={() => setPending(undefined)}>
            ←
          </button>
          <strong>Check your email</strong>
        </header>
        <h1>
          One last
          <br />
          step.
        </h1>
        <p>
          We sent a 6-digit code to <strong>{String(pending.email)}</strong>. It can take a minute; check spam too.
        </p>
        <form
          onSubmit={(e) => (
            e.preventDefault(),
            send('/auth/verify', { ...pending, ...Object.fromEntries(new FormData(e.currentTarget)) })
          )}
        >
          <label>
            Code
            <input
              name="code"
              required
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              autoComplete="one-time-code"
            />
          </label>
          {error && (
            <p className="notice pink" role="alert">
              {error}
            </p>
          )}
          <button className="button primary" disabled={busy}>
            {busy ? 'One moment…' : 'Confirm →'}
          </button>
        </form>
        <button
          className="text-button"
          disabled={busy}
          onClick={() => send(pending.name ? '/auth/signup' : '/auth/login', pending)}
        >
          Send a new code
        </button>
      </>
    )
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
        <p>Comoonly connects you with people who like what you like, online or in real life.</p>
        <ul className="welcome-points">
          <li>💬 Chat and share with communities around your interests</li>
          <li>🪦 Team up on ideas, or bring an unfinished one back to life</li>
          <li>📅 And when you want to, go to things together, never alone</li>
        </ul>
        <button className="button lime" onClick={() => setMode('signup')}>
          Find my people →
        </button>
        <button className="button" onClick={() => setMode('login')}>
          I already have an account
        </button>
        <p className="hint">
          By continuing, you agree to our{' '}
          <Link className="text-button" to="/privacy">
            privacy &amp; community guidelines
          </Link>
          .
        </p>
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
      {!signup && (
        <button className="text-button" onClick={() => (setMode('forgot'), setError(''))}>
          Forgot password?
        </button>
      )}
      <button className="text-button" onClick={() => setMode(signup ? 'login' : 'signup')}>
        {signup ? 'I already have an account' : 'New here? Create an account'}
      </button>
    </>
  )
}
