import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { whyForYou } from '../interests'
import { Mascot } from '../components/UI'

// Right after sign-up: the communities that match your interests, each a one-tap join request.
export default function ForYou() {
  const { me, groups, membership, join } = useApp()
  const [busy, setBusy] = useState('')
  const matches = groups.filter(
    (g) => !g.forEvent && !g.project && g.spots > 0 && g.ownerId !== me!.id && whyForYou(me!, { group: g }),
  )
  async function ask(id: string, category: string) {
    setBusy(id)
    try {
      await join(id, `Hi! I’m new to Comoonly and I love ${category}. Would love to join you.`)
    } catch (err) {
      alert((err as Error).message)
    }
    setBusy('')
  }
  return (
    <>
      <Mascot name="pip" className="success-art" />
      <h1>
        {matches.length ? (
          <>
            {matches.length} {matches.length === 1 ? 'community matches' : 'communities match'}
            <br />
            your interests.
          </>
        ) : (
          <>
            You’re early,
            <br />
            and that’s great.
          </>
        )}
      </h1>
      <p>
        {matches.length ? 'Ask to join with one tap.' : 'No community for your interests yet. Start the first one.'}
      </p>
      <div className="stack">
        {matches.map((g) => (
          <article className="notice" key={g.id}>
            <span className="kind-label community">🟢 Community</span>
            <h2>
              <Link to={'/posts/' + g.id}>{g.name}</Link>
            </h2>
            <p className="why">🎯 {whyForYou(me!, { group: g })}</p>
            <small>
              {g.members} {g.members === 1 ? 'member' : 'members'} · {g.location}
            </small>
            {membership[g.id] ? (
              <p role="status">{membership[g.id] === 'joined' ? 'You’re in ✓' : 'Asked ✓ The organizer will reply.'}</p>
            ) : (
              <button className="button lime" disabled={busy === g.id} onClick={() => ask(g.id, g.category)}>
                {busy === g.id ? 'Asking…' : 'Ask to join →'}
              </button>
            )}
          </article>
        ))}
      </div>
      {!matches.length && (
        <Link className="button lime" to="/create">
          Start a community →
        </Link>
      )}
      <Link className="button primary" to="/">
        Explore Comoonly →
      </Link>
    </>
  )
}
