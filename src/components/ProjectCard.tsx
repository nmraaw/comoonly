import { Link } from 'react-router-dom'
import type { Group } from '../types'
import { STAGES, STATUS, STOPPED } from '../projects'
import { useApi } from '../api'
import { Avatar } from './UI'

// One unfinished project from the Idea Graveyard: how far it got, why it stopped, and what it needs.
// `compact`: the small "Something worth picking up" card at the top of the feed.
export default function ProjectCard({ group, why, compact }: { group: Group; why?: string; compact?: boolean }) {
  const p = group.project!
  const stages = Object.keys(STAGES) as (keyof typeof STAGES)[]
  const reached = stages.indexOf(p.stage)
  const revivedBy = p.startedById && p.startedById !== group.ownerId ? group.owner : ''
  return (
    <article className={'group-card expanded project-card' + (compact ? ' compact' : '')} data-card-id={group.id}>
      <div className="card-person">
        <Link className="person-button" to={'/users/' + group.ownerId}>
          <Avatar id={group.ownerId} name={group.owner} />
          <span>
            <strong>{group.owner}</strong>
            <small>{revivedBy ? 'Reviving it' : 'Started it'}</small>
          </span>
        </Link>
      </div>
      {group.hasPhoto && !compact && (
        <Link to={'/posts/' + group.id} tabIndex={-1} aria-hidden="true">
          <img className="event-poster" src={`/api/groups/${group.id}/photo`} alt="" loading="lazy" />
        </Link>
      )}
      <span className={'kind-label project ' + p.status}>{STATUS[p.status]}</span>
      <Link className="card-title" to={'/posts/' + group.id}>
        <h2>{group.title}</h2>
      </Link>
      {revivedBy && <small className="credit">Started by {p.startedBy ?? 'someone who left'}</small>}
      <div className="progress" role="img" aria-label={`Got as far as: ${STAGES[p.stage]}`}>
        {stages.map((s, i) => (
          <span key={s} className={i <= reached ? 'done' : ''} />
        ))}
      </div>
      <small>Got as far as {STAGES[p.stage]}</small>
      {!compact && (
        <p className="stopped">
          <strong>Stopped: {STOPPED[p.stopped]}.</strong> {p.story}
        </p>
      )}
      {!!p.needs.length && (
        <p className="needs">
          Needs: <strong>{p.needs.join(' · ')}</strong>
        </p>
      )}
      {why && <p className="why">🎯 {why}</p>}
      <Link className="button primary" to={'/posts/' + group.id}>
        {p.status === 'alive' ? 'See how it turned out →' : 'Give it a second life →'}
      </Link>
    </article>
  )
}

// What happened to a project so far: posted, helpers joined, adopted, alive again.
export function ProjectHistory({ id }: { id: string }) {
  const history = useApi<{ emoji: string; text: string; createdAt: number }[]>('/groups/' + id + '/history')
  if (!history.data?.length) return null
  return (
    <>
      <h2 className="section-title">Its story so far</h2>
      <ol className="timeline">
        {history.data.map((h, i) => (
          <li key={i}>
            <span aria-hidden="true">{h.emoji}</span>
            <span>
              {h.text}
              <small>
                {new Date(h.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </small>
            </span>
          </li>
        ))}
      </ol>
    </>
  )
}
