import { Link } from 'react-router-dom'
import type { Group } from '../types'
import { useApp } from '../state/AppContext'
import { Avatar } from './UI'
import Icon from './Icon'
export default function GroupCard({ group }: { group: Group }) {
  const { saved, save, membership } = useApp()
  const status = membership[group.id]
  return (
    <article className="group-card expanded" data-card-id={group.id}>
      <div className="card-person">
        <Link className="person-button" to={'/users/' + group.ownerId}>
          <Avatar name={group.owner} />
          <span>
            <strong>{group.owner}</strong>
            <small>{group.location}</small>
          </span>
        </Link>
        <button
          className={'icon-button ' + (saved.includes(group.id) ? 'saved' : '')}
          aria-label={(saved.includes(group.id) ? 'Unsave ' : 'Save ') + group.name}
          aria-pressed={saved.includes(group.id)}
          onClick={() => save(group.id)}
        >
          <Icon name="save" />
        </button>
      </div>
      <Link className="card-title" to={'/posts/' + group.id}>
        <h2>{group.title}</h2>
      </Link>
      <p>{group.description}</p>
      <div className="meta">
        <span className="chip selected">{group.category}</span>
        <small>
          {group.mode} · {group.spots} spots left
        </small>
      </div>
      {status === 'joined' ? (
        <Link className="button primary" to={'/groups/' + group.id}>
          Open group →
        </Link>
      ) : (
        <Link className="button primary" to={'/posts/' + group.id}>
          {status === 'pending' ? 'View request →' : 'Request to join →'}
        </Link>
      )}
    </article>
  )
}
