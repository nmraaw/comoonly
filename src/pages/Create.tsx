import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Chips, Mascot } from '../components/UI'
import { useApp } from '../state/AppContext'
import { api } from '../api'
import { shrink } from '../images'
import { INTERESTS } from '../interests'
import { keyOf, NEEDS, STAGES, STOPPED } from '../projects'

const KINDS = ['🟢 A community', '🪦 An unfinished idea']
export default function Create() {
  const { me, create, refresh } = useApp()
  const [category, setCategory] = useState(me!.interests[0] ?? 'Creative')
  const [mode, setMode] = useState('In person')
  // A community, or an unfinished idea for the Idea Graveyard (/create?kind=project).
  const [params, setParams] = useSearchParams()
  const project = params.get('kind') === 'project'
  const [stage, setStage] = useState(STAGES.prototype)
  const [stopped, setStopped] = useState(STOPPED.skills)
  const [needs, setNeeds] = useState<string[]>([])
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
        mode: project ? 'Online' : mode,
        location: project || mode === 'Online' ? 'Online' : String(data.get('location')),
        spots: Number(data.get('spots')),
        ...(project && {
          project: {
            stage: keyOf(STAGES, stage),
            stopped: keyOf(STOPPED, stopped),
            story: String(data.get('story')),
            needs,
            freeToAdopt: data.get('freeToAdopt') === 'on',
          },
        }),
      })
      const photo = data.get('photo') as File | null
      if (photo?.size) {
        // The group exists already: a failed upload shouldn't make people create it twice.
        await api('/groups/' + id + '/photo', { method: 'PUT', body: { image: await shrink(photo) } }).then(
          refresh, // so the card shows it
          () => alert('It’s live, but the photo didn’t upload. Try a smaller one later.'),
        )
      }
      setCreated(id)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  if (created && project)
    return (
      <>
        <Mascot name="loop" className="success-art" />
        <h1>Resting, not gone.</h1>
        <p>
          Your idea is in the Idea Graveyard. People who like {category} hear about it, and can offer help or adopt it.
        </p>
        <Link className="button primary" to={'/posts/' + created}>
          See your idea →
        </Link>
        <button className="button" onClick={() => setCreated(null)}>
          Lay another idea to rest
        </button>
      </>
    )
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
        <strong>{project ? 'The Idea Graveyard' : 'Start a community'}</strong>
      </header>
      <h1>
        {project ? (
          <>
            Couldn’t finish it?
            <br />
            Someone else might.
          </>
        ) : (
          <>
            Find people who
            <br />
            love it too.
          </>
        )}
      </h1>
      <Chips
        label="What are you starting?"
        values={KINDS}
        value={KINDS[project ? 1 : 0]}
        onChange={(v) => setParams(v === KINDS[1] ? { kind: 'project' } : {}, { replace: true })}
      />
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit(e.currentTarget)
        }}
      >
        <label>
          {project ? 'What were you building?' : 'Name your community'}
          <input
            name="name"
            required
            maxLength={70}
            placeholder={project ? 'A bus-route app for Lahore' : 'Sunday sketchers · Lahore'}
          />
        </label>
        <label>
          {project ? 'What is it, in a few lines?' : 'What will you do together?'}
          <textarea
            name="description"
            required
            maxLength={400}
            placeholder={
              project
                ? 'Live bus times from people already on the bus. I had the map and the check-in screen working.'
                : 'A few people to sketch, swap ideas and drink a questionable amount of coffee.'
            }
          />
        </label>
        {project && (
          <>
            <h2 className="section-title">How far did it get?</h2>
            <Chips label="How far it got" values={Object.values(STAGES)} value={stage} onChange={setStage} />
            <h2 className="section-title">Why did it stop?</h2>
            <Chips label="Why it stopped" values={Object.values(STOPPED)} value={stopped} onChange={setStopped} />
            <label>
              The story (optional)
              <textarea
                name="story"
                maxLength={600}
                placeholder="Exams happened, and I never learned the backend part."
              />
            </label>
            <h2 className="section-title">What would bring it back?</h2>
            <div className="chips" role="group" aria-label="What it needs">
              {NEEDS.map((n) => (
                <button
                  type="button"
                  key={n}
                  className={needs.includes(n) ? 'chip selected' : 'chip'}
                  aria-pressed={needs.includes(n)}
                  onClick={() => setNeeds((x) => (x.includes(n) ? x.filter((y) => y !== n) : [...x, n]))}
                >
                  {n}
                </button>
              ))}
            </div>
          </>
        )}
        <h2 className="section-title">{project ? 'What is it about?' : 'Pick an interest'}</h2>
        <Chips
          label="Community interest"
          values={[...INTERESTS, 'Other']}
          value={INTERESTS.includes(category) ? category : 'Other'}
          onChange={(v) => setCategory(v === 'Other' ? '' : v)}
        />
        {!INTERESTS.includes(category) && (
          <label>
            Your interest
            <input
              required
              maxLength={30}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Chess, cricket, poetry…"
            />
          </label>
        )}
        {!project && (
          <>
            <h2 className="section-title">How will you meet?</h2>
            <Chips label="Meeting mode" values={['In person', 'Online', 'Hybrid']} value={mode} onChange={setMode} />
          </>
        )}
        {!project && mode !== 'Online' && (
          <label>
            Where?
            <input name="location" required defaultValue={me!.city} placeholder="Your city" maxLength={80} />
          </label>
        )}
        <label>
          {project ? 'How many helpers could join?' : 'How many people are you looking for?'}
          <input name="spots" type="number" min="1" max="30" required defaultValue="3" />
        </label>
        <label>
          {project ? 'A screenshot or sketch (optional)' : 'A photo or poster (optional)'}
          <input name="photo" type="file" accept="image/png,image/jpeg,image/webp" />
        </label>
        {project ? (
          <label className="check-row">
            <input type="checkbox" name="freeToAdopt" /> Free to adopt: anyone can take it over without asking me
          </label>
        ) : (
          <p className="hint">Keep the exact address private until people join.</p>
        )}
        {error && (
          <p className="notice pink" role="alert">
            {error}
          </p>
        )}
        <button className="button primary" disabled={busy}>
          {busy ? 'Publishing…' : project ? 'Give it a second chance →' : 'Start community →'}
        </button>
      </form>
    </>
  )
}
