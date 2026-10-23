import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { GroupPreview } from '../data/groups'
import { api } from '../api'
import { MockContext, type Status, type Me } from './MockContext'
export default function MockProvider({children}:{children:ReactNode}){
 const [me,setMe]=useState<Me|null|undefined>(undefined)
 const [groups,setGroups]=useState<GroupPreview[]>([])
 const [membership,setMembership]=useState<Record<string,Status>>({})
 const [saved,setSaved]=useState<string[]>([])
 // shortcut: loads the first 100 groups and filters them in the browser, switch Discover to server filters when there are more.
 const refresh=useCallback(()=>Promise.all([api<GroupPreview[]>('/groups?limit=100'),api<Record<string,Status>>('/groups/memberships'),api<string[]>('/groups/saved')])
  .then(([all,mine,bookmarks])=>{setGroups(all);setMembership(mine);setSaved(bookmarks)}),[])
 useEffect(()=>{api<Me>('/auth/me').then(setMe,()=>setMe(null))},[])
 const userId=me?.id
 useEffect(()=>{if(userId)refresh().catch(err=>console.error('Could not load groups',err))},[userId,refresh])
 return <MockContext.Provider value={{me,groups,membership,refresh,saved,
 signIn:setMe,
 logout:async()=>{await api('/auth/logout',{method:'POST'});setMe(null);setGroups([]);setMembership({});setSaved([])},
 saveProfile:async profile=>setMe(await api<Me>('/users/me',{method:'PATCH',body:profile})),
 join:async(id,intro)=>{const {status}=await api<{status:Status}>('/groups/'+id+'/requests',{method:'POST',body:{intro}});setMembership(s=>({...s,[id]:status}))},
 create:async group=>{const created=await api<GroupPreview>('/groups',{method:'POST',body:group});setGroups(s=>[created,...s]);setMembership(s=>({...s,[created.id]:'joined'}));return created.id},
 save:id=>{api<string[]>('/groups/'+id+'/save',{method:'POST'}).then(setSaved,err=>alert(err.message))},
 }}>{children}</MockContext.Provider>
}
