import { useEffect, useState } from 'react'

// Every call to the backend goes through here, so errors look the same everywhere.
// The thrown message is safe to show people (the server writes them for that).
export async function api<T>(path:string, options:{method?:string; body?:unknown}={}):Promise<T>{
 const res=await fetch('/api'+path,{
  method:options.method??'GET',
  headers:options.body===undefined?undefined:{'content-type':'application/json'},
  body:options.body===undefined?undefined:JSON.stringify(options.body),
 })
 if(res.status===204)return undefined as T
 const data=await res.json().catch(()=>({}))
 if(!res.ok)throw new Error(data.issues?.[0]?.message??data.error??'Something went wrong. Please try again.')
 return data as T
}

// Loads data for one screen. `reload()` fetches it again after a change. Pass null to skip loading.
// `everyMs` keeps checking for news (used by chat).
export function useApi<T>(path:string|null,everyMs?:number){
 const [state,setState]=useState<{path:string|null;data?:T;error?:string}>({path:null})
 const [version,setVersion]=useState(0)
 useEffect(()=>{
  if(!path)return
  let current=true // ignore answers that arrive after the person has moved to another page
  api<T>(path).then(data=>{if(current)setState({path,data})},(err:Error)=>{if(current)setState({path,error:err.message})})
  return()=>{current=false}
 },[path,version])
 // shortcut: chat checks for new messages every few seconds, switch to WebSockets if chats get busy.
 useEffect(()=>{
  if(!path||!everyMs)return
  const timer=setInterval(()=>setVersion(v=>v+1),everyMs)
  return()=>clearInterval(timer)
 },[path,everyMs])
 const fresh=state.path===path // don't show the previous page's data while the new one loads
 return {data:fresh?state.data:undefined,error:fresh?state.error:undefined,reload:()=>setVersion(v=>v+1)}
}
