import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Group } from '../types'
import { useApp } from '../state/AppContext'
import { api } from '../api'
import { STAGES, STATUS, STOPPED } from '../projects'
import DetailHeader from './DetailHeader'
import JoinAction from './JoinAction'
import { ProjectHistory } from './ProjectCard'
import { Avatar, Modal } from './UI'

// An unfinished project's public page: what it is, how far it got, why it stopped, what it needs,
// its story so far, and two ways in: offer to help (join), or adopt it (take it over).
export default function ProjectPage({ group }: { group: Group }) {
  const { me, refresh, saved, save } = useApp()
  const p = group.project!
  const [adopting, setAdopting] = useState(false)
  const [asked, setAsked] = useState(false)
  const [error, setError] = useState('')
  const stages = Object.keys(STAGES) as (keyof typeof STAGES)[]
  const owner = group.ownerId === me!.id
  async function adopt(note: string) {
    setError('')
    try {
      const { status } = await api<{ status: string }>('/groups/' + group.id + '/adopt', {
        method: 'POST',
        body: { note },
      })
      await refresh()
      setAdopting(false)
      if (status === 'pending') setAsked(true)
    } catch (err) {
      setError((err as Error).message)
    }
  }
  return (
    <>
      <DetailHeader title="The Idea Graveyard" fallback="/" />
      {group.hasPhoto && <img className="event-poster" src={`/api/groups/${group.id}/photo`} alt="" />}
      <span className={'kind-label project ' + p.status}>{STATUS[p.status]}</span>
      <h1>{group.title}</h1>
      <Link className="person-button" to={'/users/' + (p.startedById ?? group.ownerId)}>
        <Avatar id={p.startedById ?? group.ownerId} name={p.startedBy ?? group.owner} />
        <span>
          <strong>Started by {p.startedBy ?? 'someone who left'}</strong>
          <small>
            {p.startedById !== group.ownerId ? `Now looked after by ${group.owner}` : 'Still looking after it'} · see
            profile →
          </small>
        </span>
      </Link>
      <p>{group.description}</p>
      <div className="notice project-facts">
        <div className="progress" role="img" aria-label={`Got as far as: ${STAGES[p.stage]}`}>
          {stages.map((s, i) => (
            <span key={s} className={i <= stages.indexOf(p.stage) ? 'done' : ''} />
          ))}
        </div>
        <p>
          Got as far as <strong>{STAGES[p.stage]}</strong>
        </p>
        <p>
          <strong>Why it stopped: {STOPPED[p.stopped]}.</strong> {p.story}
        </p>
        {!!p.needs.length && (
          <p>
            What would bring it back: <strong>{p.needs.join(' · ')}</strong>
          </p>
        )}
      </div>
      {owner ? (
        <Link className="button primary" to={'/groups/' + group.id + '?tab=Project'}>
          Open your project →
        </Link>
      ) : (
        <>
          <JoinAction id={group.id} help />
          {p.status !== 'alive' &&
            (asked ? (
              <p className="notice mint" role="status">
                Asked to adopt · {group.owner.split(' ')[0]} will decide.
              </p>
            ) : (
              <button className="button lime" onClick={() => setAdopting(true)}>
                {p.freeToAdopt ? '🔁 Adopt it (free to adopt)' : '🔁 Ask to adopt it'}
              </button>
            ))}
        </>
      )}
      <button className="text-button" aria-pressed={saved.includes(group.id)} onClick={() => save(group.id)}>
        {saved.includes(group.id) ? 'Saved ✓' : 'Save for later'}
      </button>
      <ProjectHistory id={group.id} />
      {adopting && (
        <Modal title="Give it a second life" onClose={() => setAdopting(false)}>
          <form onSubmit={(e) => (e.preventDefault(), adopt(String(new FormData(e.currentTarget).get('note'))))}>
            <p>
              {p.freeToAdopt
                ? 'It’s free to adopt: it becomes yours straight away. '
                : `${group.owner.split(' ')[0]} decides who takes it over. `}
              {p.startedBy ?? 'Its creator'} stays credited as the one who started it.
            </p>
            <label>
              What would you do with it?
              <textarea
                name="note"
                required
                maxLength={300}
                placeholder="I’d build the backend and launch it at uni."
              />
            </label>
            {error && (
              <p className="notice pink" role="alert">
                {error}
              </p>
            )}
            <button className="button primary">{p.freeToAdopt ? 'Adopt it →' : 'Ask to adopt →'}</button>
          </form>
        </Modal>
      )}
    </>
  )
}
