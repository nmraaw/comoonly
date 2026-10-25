import { Link, useParams } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import GroupWorkspace from '../components/GroupWorkspace'
import NotFound from '../components/NotFound'
import DetailHeader from '../components/DetailHeader'
import JoinAction from '../components/JoinAction'
export default function GroupDetail() {
  const { id } = useParams()
  const { groups, membership } = useApp()
  const group = groups.find((g) => g.id === id)
  if (!group) return <NotFound type="Group" to="/groups" />
  if (membership[group.id] === 'joined') return <GroupWorkspace key={group.id} id={group.id} />
  return (
    <>
      <DetailHeader title="Your little circles" fallback="/groups" />
      <div className={'activity-card ' + group.color}>
        <h1>{group.name}</h1>
        <p>{group.description}</p>
        <small>
          {group.members} members · {group.location}
        </small>
      </div>
      <p>Join this group to take part in its chat.</p>
      <JoinAction id={group.id} />
      <Link className="button" to={'/posts/' + group.id}>
        View invitation →
      </Link>
    </>
  )
}
