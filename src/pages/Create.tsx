import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Chips, Mascot } from '../components/UI'
import { useApp } from '../state/AppContext'
import { api } from '../api'
import { shrink } from '../images'
import { INTERESTS } from '../interests'
export default function Create() {
  const { me, create, refresh } = useApp()
  const [category, setCategory] = useState(me!.interests.find((i) => INTERESTS.includes(i)) ?? 'Creative')
  const [mode, setMode] = useState('In person')
  const [created, setCreated] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(form: HTMLFormElement) {
    const data = new FormData(form)
    setBusy(true)
    setError('')
    try {
      const id = await create({
        name: String(data.get('name')),
        description: String(data.get('description')),
        category,
        mode,
        location: mode === 'Online' ? 'Online' : String(data.get('location')),
        spots: Number(data.get('spots')),
      })
      const photo = data.get('photo') as File | null
      if (photo?.size) {
        // The group exists already: a failed upload shouldn't make people create it twice.
        await api('/groups/' + id + '/photo', { method: 'PUT', body: { image: await shrink(photo) } }).then(
          refresh, // so the card shows it
          () => alert('Your community is live, but the photo didn’t upload. Try a smaller one later.'),
        )
      }
      setCreated(id)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  if (created)
    return (
      <>
        <Mascot name="pip" className="success-art" />
        <h1>Hello, possibility.</h1>
        <p>Your community is live. People who like {category} hear about it, and anyone can find it on Discover.</p>
        <Link className="button primary" to={'/groups/' + created}>
          Open your community →
        </Link>
        <button className="button" onClick={() => setCreated(null)}>
          Start another community
        </button>
      </>
    )
  return (
    <>
      <header className="page-top">
        <strong>Start a community</strong>
      </header>
      <h1>
        Find people who
        <br />
        love it too.
      </h1>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit(e.currentTarget)
        }}
      >
        <label>
          Name your community
          <input name="name" required maxLength={70} placeholder="Sunday sketchers · Lahore" />
        </label>
        <label>
          What will you do together?
          <textarea
            name="description"
            required
            maxLength={400}
            placeholder="A few people to sketch, swap ideas and drink a questionable amount of coffee."
          />
        </label>
        <h2 className="section-title">Pick an interest</h2>
        <Chips label="Community interest" values={INTERESTS} value={category} onChange={setCategory} />
        <h2 className="section-title">How will you meet?</h2>
        <Chips label="Meeting mode" values={['In person', 'Online', 'Hybrid']} value={mode} onChange={setMode} />
        {mode !== 'Online' && (
          <label>
            Where?
            <input name="location" required defaultValue={me!.city} placeholder="Your city" maxLength={80} />
          </label>
        )}
        <label>
          How many people are you looking for?
          <input name="spots" type="number" min="1" max="30" required defaultValue="3" />
        </label>
        <label>
          A photo or poster (optional)
          <input name="photo" type="file" accept="image/png,image/jpeg,image/webp" />
        </label>
        <p className="hint">Keep the exact address private until people join.</p>
        {error && (
          <p className="notice pink" role="alert">
            {error}
          </p>
        )}
        <button className="button primary" disabled={busy}>
          {busy ? 'Publishing…' : 'Start community →'}
        </button>
      </form>
    </>
  )
}
