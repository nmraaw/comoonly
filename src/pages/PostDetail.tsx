import { Link, Navigate, useParams } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import DetailHeader from '../components/DetailHeader'
import NotFound from '../components/NotFound'
import JoinAction from '../components/JoinAction'
import { Avatar, Empty } from '../components/UI'
import { useApi } from '../api'
import type { EventItem } from '../types'
import ProjectPage from '../components/ProjectPage'
import { interestsOf } from '../interests'
export default function PostDetail() {
  const { id } = useParams()
  const { groups, saved, save } = useApp()
  const group = groups.find((g) => g.id === id)
  // An event's group is reached through its event: that page says what it is and lets you join.
  const event = useApi<EventItem>(group?.forEvent ? '/events/for-group/' + id : null)
  if (!group) return <NotFound type="Post" />
  if (event.data) return <Navigate replace to={'/events/' + event.data.id} />
  if (group.forEvent && !event.error) return <Empty>Loading…</Empty>
  if (group.project) return <ProjectPage group={group} />
  return (
    <>
      <DetailHeader title="Find your people" fallback="/" />
      <Link className="person-button" to={'/users/' + group.ownerId}>
        <Avatar id={group.ownerId} name={group.owner} />
        <span>
          <strong>{group.owner}</strong>
          <small>{group.location} · Organizer</small>
        </span>
      </Link>
      {group.hasPhoto && <img className="event-poster" src={`/api/groups/${group.id}/photo`} alt="" />}
      <span className="kind-label community">🟢 Community</span>
      <h1>{group.title}</h1>
      <div className="chips">
        {interestsOf(group).map((i) => (
          <span className="chip selected" key={i}>
            {i}
          </span>
        ))}
        <span className="chip">{group.mode}</span>
      </div>
      <p>{group.description}</p>
      <div className="notice">
        <p>{group.location} · Meet in a public place</p>
        <p>
          {group.spots} spots open · {group.members} members
        </p>
      </div>
      <JoinAction id={group.id} />
      <button className="text-button" aria-pressed={saved.includes(group.id)} onClick={() => save(group.id)}>
        {saved.includes(group.id) ? 'Saved ✓' : 'Save for later'}
      </button>
    </>
  )
}
