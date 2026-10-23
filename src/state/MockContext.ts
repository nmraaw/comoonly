import { createContext, useContext } from 'react'
import type { GroupPreview } from '../data/groups'
import type { User } from '../data/users'
export type Message = { id:string; authorId:string; author:string; text:string; createdAt:number }
export type Task = { id:string; title:string; done:boolean }
export type Activity = { id:string; groupId:string; title:string; date:string; place:string; plan:string; notes:string; going:boolean; goingCount:number }
export type Status = 'pending' | 'joined'
export type Me = User & { email:string; isAdmin:boolean }
export type ProfileInput = Omit<User,'id'|'connection'|'blocked'>
export type NewGroup = { name:string; description:string; category:string; mode:string; location:string; spots:number }
// App-wide state every screen shares. The name is historical: it all comes from the backend now.
// Screen-specific data (chat, activities, to-dos, profiles) is loaded by that screen with useApi().
export type MockState = {
 me:Me|null|undefined; // undefined = still checking, null = logged out
 signIn:(user:Me)=>void; logout:()=>Promise<void>; saveProfile:(profile:ProfileInput)=>Promise<void>;
 groups:GroupPreview[]; membership:Record<string,Status>; refresh:()=>Promise<void>;
 join:(id:string,intro:string)=>Promise<void>; create:(group:NewGroup)=>Promise<string>;
 saved:string[]; save:(id:string)=>void;
 unread:{total:number;messages:number}; refreshUnread:()=>void;
}
export const MockContext = createContext<MockState|null>(null)
export function useMock(){const value=useContext(MockContext); if(!value) throw new Error('Missing mock provider'); return value}
