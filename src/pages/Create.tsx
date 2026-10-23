import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Chips, Mascot } from '../components/UI'
import { useApp } from '../state/AppContext'
export default function Create() {
  const { create } = useApp()
  const [category, setCategory] = useState('Creative')
  const [mode, setMode] = useState('In person')
  const [created, setCreated] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(form: HTMLFormElement) {
    const data = new FormData(form)
    setBusy(true)
    setError('')
    try {
      setCreated(
        await create({
          name: String(data.get('name')),
          description: String(data.get('description')),
          category,
          mode,
          location: mode === 'Online' ? 'Online' : String(data.get('location')),
          spots: Number(data.get('spots')),
        }),
      )
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
        <p>Your invitation is live. People can now find it on Discover and ask to join.</p>
        <Link className="button primary" to={'/groups/' + created}>
          Explore your group →
        </Link>
        <button className="button" onClick={() => setCreated(null)}>
          Create another group
        </button>
      </>
    )
  return (
    <>
      <header className="page-top">
        <strong>Start something</strong>
      </header>
      <h1>
        Put your idea
        <br />
        out into the world.
      </h1>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit(e.currentTarget)
        }}
      >
        <label>
          Give your plan a title
          <input name="name" required maxLength={70} placeholder="Sunday sketch & coffee" />
        </label>
        <label>
          What are you looking for?
          <textarea
            name="description"
            required
            maxLength={400}
            placeholder="A few people to sketch, swap ideas and drink a questionable amount of coffee."
          />
        </label>
        <h2 className="section-title">Pick an interest</h2>
        <Chips
          label="Group interest"
          values={['Creative', 'Music', 'Tech', 'Film', 'Reading']}
          value={category}
          onChange={setCategory}
        />
        <h2 className="section-title">How will you meet?</h2>
        <Chips label="Meeting mode" values={['In person', 'Online', 'Hybrid']} value={mode} onChange={setMode} />
        {mode !== 'Online' && (
          <label>
            Where?
            <input name="location" required defaultValue="Sialkot" maxLength={80} />
          </label>
        )}
        <label>
          How many people are you looking for?
          <input name="spots" type="number" min="1" max="30" required defaultValue="3" />
        </label>
        <p className="hint">Keep the exact address private until people join.</p>
        {error && (
          <p className="notice pink" role="alert">
            {error}
          </p>
        )}
        <button className="button primary" disabled={busy}>
          {busy ? 'Publishing…' : 'Publish invitation →'}
        </button>
      </form>
    </>
  )
}
