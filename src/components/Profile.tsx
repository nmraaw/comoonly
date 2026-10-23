import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMock } from '../state/MockContext'
import type { User } from '../data/users'
import { api } from '../api'
import { Avatar, Chips, Modal } from './UI'
const REASONS=['Harassment','Spam or scam','Fake profile','Felt unsafe at a meetup','Something else']
// `onChange` lets the page reload the profile after a connection or block change.
export default function Profile({own=false,user,onChange}:{own?:boolean;user?:User;onChange?:()=>void}){const {me}=useMock();const person=user??me!;const status=person.connection;const [busy,setBusy]=useState(false);const [reporting,setReporting]=useState(false);const [reason,setReason]=useState(REASONS[0]);const [sent,setSent]=useState(false)
 async function act(path:string,body?:unknown,method='POST'){setBusy(true);try{await api(path,{method,body})}catch(err){alert((err as Error).message)}setBusy(false);onChange?.()}
 async function report(form:HTMLFormElement){try{await api('/users/'+person.id+'/report',{method:'POST',body:{reason,details:String(new FormData(form).get('details'))}});setSent(true)}catch(err){alert((err as Error).message)}}
 return <><div className="profile-card lilac"><div className="person-button"><Avatar name={person.name}/><div><h1>{person.name}</h1><small>{[person.city,person.tagline].filter(Boolean).join(' · ')}</small></div></div>{person.bio&&<p>{person.bio}</p>}</div>
 {!own&&(person.blocked?<div className="notice pink" role="status">You blocked {person.name}. They can’t see your profile, message you or join your groups.</div>
 :status==='accepted'?<Link className="button lime" to={'/messages?chat='+person.id}>Message {person.name} →</Link>
 :status==='incoming'?<div className="two-actions"><button className="button" disabled={busy} onClick={()=>act('/connections/'+person.id,{decision:'decline'})}>Decline</button><button className="button lime" disabled={busy} onClick={()=>act('/connections/'+person.id,{decision:'accept'})}>Accept connection</button></div>
 :<button className="button lime" disabled={busy||status==='pending'} onClick={()=>act('/users/'+person.id+'/connect')}>{status==='pending'?'Connection request pending':'+ Connect with '+person.name}</button>)}
 <h2 className="section-title">My kind of things ✧</h2><div className="chips">{person.interests.map(x=><span className="chip" key={x}>{x}</span>)}</div>
 {!own&&<div className="two-actions"><button className="text-button" disabled={busy} onClick={()=>person.blocked?act('/users/'+person.id+'/block',undefined,'DELETE'):confirm(`Block ${person.name}? You won’t be connected anymore.`)&&act('/users/'+person.id+'/block')}>{person.blocked?'Unblock':'Block'}</button><button className="text-button" onClick={()=>{setSent(false);setReporting(true)}}>Report</button></div>}
 {reporting&&<Modal title={sent?'Thanks for telling us.':'What happened?'} onClose={()=>setReporting(false)}>{sent?<><p>We’ll look into it. {person.blocked?'':'You can also block them so they can’t reach you.'}</p><button className="button primary" onClick={()=>setReporting(false)}>Done</button></>:<form onSubmit={e=>{e.preventDefault();report(e.currentTarget)}}><Chips label="Reason" values={REASONS} value={reason} onChange={setReason}/><label>Anything else we should know? (optional)<textarea name="details" maxLength={1000}/></label><button className="button primary">Send report</button></form>}</Modal>}</>}
