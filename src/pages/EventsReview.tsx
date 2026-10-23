import { useState } from 'react'
import { api, useApi } from '../api'
import DetailHeader from '../components/DetailHeader'
import NotFound from '../components/NotFound'
import { Empty } from '../components/UI'
import { useMock } from '../state/MockContext'
import type { EventItem } from './Events'
type Report = { source:string; via?:string; found?:number; added?:number; error?:string }[]

// The same fields for editing a found event and for adding one by hand.
function Fields({e}:{e?:Partial<EventItem>}){return <>
 <label>Title<input name="title" required maxLength={200} defaultValue={e?.title}/></label>
 <label>Starts<input name="date" type="datetime-local" required defaultValue={e?.date&&(e.date.length===10?e.date+'T00:00':e.date.slice(0,16))}/></label>{/* some sites give only a day */}
 <label>City<input name="city" maxLength={80} defaultValue={e?.city}/></label>
 <label>How<select name="mode" defaultValue={e?.mode??'In person'}><option>In person</option><option>Online</option><option>Hybrid</option></select></label>
 <label>Category<input name="category" required maxLength={40} defaultValue={e?.category??'Event'}/></label>
 <label>About<textarea name="description" maxLength={1000} defaultValue={e?.description}/></label>
 <label>Official registration link<input name="registerUrl" type="url" required defaultValue={e?.registerUrl}/></label></>}

// The date field can't be left without a time; midnight means "no time given", so save just the day.
const values=(form:HTMLFormElement)=>{const data=Object.fromEntries(new FormData(form)) as Record<string,string>;data.date=data.date.replace(/T00:00$/,'');return data}

// Phone screenshots are large; scale to at most 1600px and save as JPEG before sending (still sharp enough to read).
async function shrink(file:File){const img=await createImageBitmap(file);const scale=Math.min(1,1600/Math.max(img.width,img.height));const canvas=document.createElement('canvas');canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);canvas.getContext('2d')!.drawImage(img,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/jpeg',0.85)}

// Admins only: run the finder, then approve, fix or reject what it found. Nothing goes live on its own.
export default function EventsReview(){
 const {me}=useMock();const drafts=useApi<EventItem[]>(me!.isAdmin?'/events/review':null);const [report,setReport]=useState<Report|null>(null);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [postNote,setPostNote]=useState('');const [reading,setReading]=useState(false)
 if(!me!.isAdmin)return <NotFound/>
 async function scan(){setBusy(true);setReport(null);try{setReport(await api<Report>('/events/scan',{method:'POST'}));drafts.reload()}catch(err){alert((err as Error).message)}setBusy(false)}
 async function review(id:string,form:HTMLFormElement,status:'published'|'rejected'){try{await api('/events/'+id,{method:'PATCH',body:{...values(form),status}});drafts.reload()}catch(err){alert((err as Error).message)}}
 async function fromPost(form:HTMLFormElement){const data=new FormData(form);const file=data.get('image') as File;setReading(true);setPostNote('');try{const image=file?.size?await shrink(file):undefined;const r=await api<{found:number;added:number}>('/events/from-post',{method:'POST',body:{postUrl:data.get('postUrl'),text:data.get('text'),image}});setPostNote(r.added?`Found ${r.added} event${r.added>1?'s':''}. Check ${r.added>1?'them':'it'} above, then publish.`:r.found?'Already in the list.':'The AI couldn’t find an upcoming event in that post.');if(r.added)form.reset();drafts.reload()}catch(err){setPostNote((err as Error).message)}setReading(false)}
 async function add(form:HTMLFormElement){const data=values(form);try{await api('/events',{method:'POST',body:{...data,sourceUrl:data.registerUrl}});form.reset();setMessage('Published. It’s on the Events page now.')}catch(err){setMessage((err as Error).message)}}
 return <><DetailHeader title="Review events" fallback="/events"/><h1>New events,<br/>checked by you.</h1>
 <button className="button primary" disabled={busy} onClick={scan}>{busy?'Looking… this can take a minute':'Find new events'}</button>
 {report&&<div className="notice mint">{report.map(r=><p key={r.source}><strong>{r.source}</strong>: {r.error?'couldn’t read it ('+r.error+')':`${r.found} found via ${r.via}, ${r.added} new`}</p>)}</div>}
 <h2 className="section-title">Waiting for review</h2>{drafts.data&&!drafts.data.length&&<Empty>Nothing waiting. Press “Find new events”.</Empty>}
 {drafts.data?.map(e=><form className="group-card expanded" key={e.id} onSubmit={ev=>{ev.preventDefault();review(e.id,ev.currentTarget,'published')}}><small><a className="text-button" href={e.sourceUrl} target="_blank" rel="noopener noreferrer">Found on {new URL(e.sourceUrl).hostname} ↗</a></small><Fields e={e}/><div className="two-actions"><button type="button" className="button" onClick={ev=>review(e.id,ev.currentTarget.form!,'rejected')}>Reject</button><button className="button lime">Publish</button></div></form>)}
 <h2 className="section-title">Add from an Instagram or TikTok post</h2><p className="hint">Paste the caption, add a screenshot of the poster, or both. The AI fills in the details; you check them above.</p><form onSubmit={ev=>{ev.preventDefault();fromPost(ev.currentTarget)}}><label>Link to the post<input name="postUrl" type="url" required placeholder="https://www.instagram.com/p/…"/></label><label>Caption<textarea name="text" maxLength={5000}/></label><label>Poster screenshot<input name="image" type="file" accept="image/png,image/jpeg,image/webp"/></label>{postNote&&<p className="notice mint" role="status">{postNote}</p>}<button className="button primary" disabled={reading}>{reading?'Reading the post…':'Find the event'}</button></form>
 <h2 className="section-title">Add an event yourself</h2><form onSubmit={ev=>{ev.preventDefault();add(ev.currentTarget)}}><Fields/>{message&&<p className="notice mint" role="status">{message}</p>}<button className="button primary">Publish event</button></form></>
}
