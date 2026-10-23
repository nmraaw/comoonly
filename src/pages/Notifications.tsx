import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api, useApi } from '../api'
import { useMock } from '../state/MockContext'
import DetailHeader from '../components/DetailHeader'
import { Empty } from '../components/UI'
type Notice = { id:string; kind:'message'|'update'; text:string; link:string; read:boolean; createdAt:number }
const ago=(time:number)=>{const m=Math.round((Date.now()-time)/60000);return m<1?'just now':m<60?m+' min ago':m<1440?Math.round(m/60)+' h ago':Math.round(m/1440)+' d ago'}
// Everything that happened for you. Opening the page marks it all as seen (the list still shows what was new).
export default function Notifications(){
 const {refreshUnread}=useMock();const {data,error}=useApi<Notice[]>('/notifications')
 useEffect(()=>{if(data?.some(n=>!n.read))api('/notifications/read',{method:'POST'}).then(refreshUnread,()=>{})},[data,refreshUnread])
 return <><DetailHeader title="Notifications" fallback="/"/><h1>What’s new.</h1>
 {error&&<Empty>{error}</Empty>}{data&&!data.length&&<Empty>Nothing yet. Join a group or say hello to someone.</Empty>}
 <div className="stack">{data?.map(n=><Link key={n.id} className={'conversation '+(n.read?'':n.kind==='message'?'lilac':'mint')} to={n.link}><div><h2>{n.text}</h2><p>{ago(n.createdAt)}{n.read?'':' · new'}</p></div></Link>)}</div></>
}
