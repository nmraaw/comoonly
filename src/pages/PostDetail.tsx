import { Link, useParams } from 'react-router-dom'
import { useMock } from '../state/MockContext'
import DetailHeader from '../components/DetailHeader'
import NotFound from '../components/NotFound'
import JoinAction from '../components/JoinAction'
import { Avatar } from '../components/UI'
export default function PostDetail(){const {id}=useParams();const {groups,saved,save}=useMock();const group=groups.find(g=>g.id===id);if(!group)return <NotFound type="Post"/>;return <><DetailHeader title="Find your people" fallback="/"/><Link className="person-button" to={'/users/'+group.ownerId}><Avatar name={group.owner}/><span><strong>{group.owner}</strong><small>{group.location} · Organizer</small></span></Link><h1>{group.title}</h1><div className="chips"><span className="chip selected">{group.category}</span><span className="chip">{group.mode}</span></div><p>{group.description}</p><div className="notice"><p>{group.location} · Meet in a public place</p><p>{group.spots} spots open · {group.members} members</p></div><JoinAction id={group.id}/><button className="text-button" aria-pressed={saved.includes(group.id)} onClick={()=>save(group.id)}>{saved.includes(group.id)?'Saved ✓':'Save for later'}</button></>}
