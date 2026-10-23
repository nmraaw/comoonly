import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DetailHeader from '../components/DetailHeader'
import { Logo } from '../components/UI'
import { useApp } from '../state/AppContext'
// The last four match event types, so you hear about new hackathons, workshops etc. (see events.service.ts).
const INTERESTS = [
  'Music',
  'Creative',
  'Tech',
  'Film',
  'Reading',
  'Games',
  'Drawing',
  'Coffee',
  'Walking',
  'Design',
  'Sports',
  'Food',
  'Hackathons',
  'Workshops',
  'Competitions',
  'Meetups',
]
// `first` = right after sign-up (no way back yet); otherwise it's "Edit profile" from the Me tab.
export default function ProfileSetup({ first = false }: { first?: boolean }) {
  const { me, saveProfile } = useApp()
  const navigate = useNavigate()
  const [picked, setPicked] = useState(me!.interests)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const options = [...new Set([...INTERESTS, ...me!.interests])]
  async function submit(form: HTMLFormElement) {
    const data = new FormData(form)
    setBusy(true)
    setError('')
    try {
      await saveProfile({
        name: String(data.get('name')),
        city: String(data.get('city')),
        tagline: String(data.get('tagline')),
        bio: String(data.get('bio')),
        interests: picked,
      })
      if (!first) navigate('/me')
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }
  return (
    <>
      {first ? (
        <header className="page-top">
          <Logo />
        </header>
      ) : (
        <DetailHeader title="Edit profile" fallback="/me" />
      )}
      <h1>
        {first ? (
          <>
            Let’s make your
            <br />
            little corner.
          </>
        ) : (
          <>
            Your little
            <br />
            corner.
          </>
        )}
      </h1>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit(e.currentTarget)
        }}
      >
        <label>
          Your name
          <input name="name" required maxLength={60} defaultValue={me!.name} />
        </label>
        <label>
          City
          <input name="city" maxLength={80} defaultValue={me!.city} placeholder="Sialkot" />
        </label>
        <label>
          A short line about you
          <input name="tagline" maxLength={80} defaultValue={me!.tagline} placeholder="Here for the music" />
        </label>
        <label>
          A little more
          <textarea
            name="bio"
            maxLength={400}
            defaultValue={me!.bio}
            placeholder="Making music, questionable coffee, and hopefully some good friends along the way."
          />
        </label>
        <h2 className="section-title">My kind of things ✧</h2>
        <div className="chips" role="group" aria-label="Interests">
          {options.map((x) => (
            <button
              type="button"
              key={x}
              className={picked.includes(x) ? 'chip selected' : 'chip'}
              aria-pressed={picked.includes(x)}
              onClick={() => setPicked((p) => (p.includes(x) ? p.filter((y) => y !== x) : [...p, x]))}
            >
              {x}
            </button>
          ))}
        </div>
        <p className="hint">Pick at least one. Only share what feels right.</p>
        {error && (
          <p className="notice pink" role="alert">
            {error}
          </p>
        )}
        <button className="button primary" disabled={busy || !picked.length}>
          {busy ? 'Saving…' : first ? 'Start exploring →' : 'Save profile →'}
        </button>
      </form>
    </>
  )
}
