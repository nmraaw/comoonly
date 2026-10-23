import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMock } from '../state/MockContext'
import type { User } from '../data/users'
import { api } from '../api'
import { Avatar } from './UI'
// `onChange` lets the page reload the profile after a connection change.
export default function Profile({own=false,user,onChange}:{own?:boolean;user?:User;onChange?:()=>void}){const {me}=useMock();const person=user??me!;const status=person.connection;const [busy,setBusy]=useState(false)
 async function act(path:string,body?:unknown){setBusy(true);try{await api(path,{method:'POST',body})}catch(err){alert((err as Error).message)}setBusy(false);onChange?.()}
 return <><div className="profile-card lilac"><div className="person-button"><Avatar name={person.name}/><div><h1>{person.name}</h1><small>{[person.city,person.tagline].filter(Boolean).join(' · ')}</small></div></div>{person.bio&&<p>{person.bio}</p>}</div>
 {!own&&(status==='accepted'?<Link className="button lime" to={'/messages?chat='+person.id}>Message {person.name} →</Link>
 :status==='incoming'?<div className="two-actions"><button className="button" disabled={busy} onClick={()=>act('/connections/'+person.id,{decision:'decline'})}>Decline</button><button className="button lime" disabled={busy} onClick={()=>act('/connections/'+person.id,{decision:'accept'})}>Accept connection</button></div>
 :<button className="button lime" disabled={busy||status==='pending'} onClick={()=>act('/users/'+person.id+'/connect')}>{status==='pending'?'Connection request pending':'+ Connect with '+person.name}</button>)}
 <h2 className="section-title">My kind of things ✧</h2><div className="chips">{person.interests.map(x=><span className="chip" key={x}>{x}</span>)}</div></>}
