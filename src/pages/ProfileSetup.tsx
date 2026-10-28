import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DetailHeader from '../components/DetailHeader'
import { Avatar, Logo } from '../components/UI'
import { api } from '../api'
import { photoChanged, shrink } from '../images'
import { useApp } from '../state/AppContext'
import type { Gender } from '../types'
import { INTERESTS } from '../interests'
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
      const photo = data.get('photo') as File | null
      if (photo?.size) {
        await api('/users/me/photo', { method: 'PUT', body: { image: await shrink(photo, 600) } })
        photoChanged()
      }
      await saveProfile({
        name: String(data.get('name')),
        city: String(data.get('city')),
        tagline: String(data.get('tagline')),
        bio: String(data.get('bio')),
        gender: String(data.get('gender')) as Gender,
        instagram: String(data.get('instagram')),
        tiktok: String(data.get('tiktok')),
        interests: picked,
      })
      navigate(first ? '/for-you' : '/me') // new people first see the communities that match them
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
        <div className="photo-row">
          <Avatar id={me!.id} name={me!.name} />
          <label>
            Profile photo (optional)
            <input name="photo" type="file" accept="image/png,image/jpeg,image/webp" />
          </label>
        </div>
        <label>
          Your name
          <input name="name" required maxLength={60} defaultValue={me!.name} />
        </label>
        <label>
          City
          <input name="city" maxLength={80} defaultValue={me!.city} placeholder="Sialkot" />
        </label>
        <label>
          I am
          <select name="gender" defaultValue={me!.gender}>
            <option value="">Choose…</option>
            <option value="woman">A woman</option>
            <option value="man">A man</option>
            <option value="private">Prefer not to say</option>
          </select>
        </label>
        <p className="hint">
          Only used for women-only crews, never shown on your profile. A full profile (city, this, a line about you,
          interests) gets you ✓ Verified, needed to go to events in a crew.
        </p>
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
        <h2 className="section-title">Socials (optional)</h2>
        <p className="hint">Helps people see you’re real before meeting up. Just your username.</p>
        <label>
          Instagram
          <input name="instagram" maxLength={80} defaultValue={me!.instagram} placeholder="sara.draws" />
        </label>
        <label>
          TikTok
          <input name="tiktok" maxLength={80} defaultValue={me!.tiktok} placeholder="sara.draws" />
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
