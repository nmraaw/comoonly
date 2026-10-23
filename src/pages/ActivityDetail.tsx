import { Link, useParams } from 'react-router-dom'
import { useMock, type Activity } from '../state/MockContext'
import { api, useApi } from '../api'
import NotFound from '../components/NotFound'
import DetailHeader from '../components/DetailHeader'
import JoinAction from '../components/JoinAction'
import { Empty } from '../components/UI'
// Non-members get { locked: true } from the server: just enough to offer joining the group.
type Answer = Activity | { id:string; groupId:string; locked:true }
export default function ActivityDetail(){const {id}=useParams();const {groups}=useMock();const {data,error,reload}=useApi<Answer>('/activities/'+encodeURIComponent(id!));if(error)return <NotFound type="Activity" to="/groups"/>;if(!data)return <Empty>Loading…</Empty>;const group=groups.find(g=>g.id===data.groupId);if(!group)return <NotFound type="Activity" to="/groups"/>
 if('locked' in data)return <><DetailHeader title="It’s a plan" fallback={'/posts/'+group.id}/><h1>A plan for {group.name}</h1><p>Join this group to see its activity details.</p><JoinAction id={group.id}/></>
 const event=data;async function toggle(){try{await api('/activities/'+event.id+'/going',{method:'POST'})}catch(err){alert((err as Error).message)}reload()}
 return <><DetailHeader title="It’s a plan" fallback={'/groups/'+group.id+'?tab=Activities'}/><div className="notice pink"><strong>{new Date(event.date).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</strong></div><h1>{event.title}</h1><Link className="text-button" to={'/groups/'+group.id}>{group.name} →</Link><div className="notice"><p>{new Date(event.date).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'})}</p><p>{event.place}</p><p>{event.goingCount} going</p></div>{event.plan&&<><h2 className="section-title">The very loose plan</h2><p>{event.plan.split('\n').filter(Boolean).map((step,i)=><span key={i}>{String(i+1).padStart(2,'0')} · {step}<br/></span>)}</p></>}{event.notes&&<div className="notice mint"><strong>Before you go</strong><p>{event.notes}</p><Link className="text-button" to={'/groups/'+group.id+'?tab=To-do'}>Open group to-dos →</Link></div>}<button className={'button '+(event.going?'lime':'primary')} aria-pressed={event.going} onClick={toggle}>{event.going?'✓ I’m going':'Join activity'}</button><Link className="button" to={'/groups/'+group.id+'?tab=Chat'}>Back to group chat</Link></>}
