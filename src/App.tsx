import { BrowserRouter, Route, Routes } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import NotFound from './components/NotFound'
import PostDetail from './pages/PostDetail'
import GroupDetail from './pages/GroupDetail'
import ActivityDetail from './pages/ActivityDetail'
import UserDetail from './pages/UserDetail'
import Discover from './pages/Discover'
import Groups from './pages/Groups'
import Create from './pages/Create'
import Messages from './pages/Messages'
import Me from './pages/Me'
import Welcome from './pages/Welcome'
import ProfileSetup from './pages/ProfileSetup'
import Events from './pages/Events'
import EventsReview from './pages/EventsReview'
import Notifications from './pages/Notifications'
import Admin from './pages/Admin'
import MockProvider from './state/MockProvider'
import { useMock } from './state/MockContext'
import './App.css'
// Logged out → Welcome. New account without interests → profile setup. Otherwise the app.
function Gate(){
 const {me}=useMock()
 if(me===undefined)return null // checking the session; avoids flashing the login screen
 if(!me||!me.interests.length)return <div className="app-shell"><main id="main-content">{me?<ProfileSetup first/>:<Welcome/>}</main></div>
 return <Routes><Route element={<AppLayout/>}><Route index element={<Discover/>}/><Route path="groups" element={<Groups/>}/><Route path="create" element={<Create/>}/><Route path="messages" element={<Messages/>}/><Route path="me" element={<Me/>}/><Route path="me/edit" element={<ProfileSetup/>}/><Route path="posts/:id" element={<PostDetail/>}/><Route path="groups/:id" element={<GroupDetail/>}/><Route path="activities/:id" element={<ActivityDetail/>}/><Route path="users/:id" element={<UserDetail/>}/><Route path="events" element={<Events/>}/><Route path="events/review" element={<EventsReview/>}/><Route path="notifications" element={<Notifications/>}/><Route path="admin" element={<Admin/>}/><Route path="*" element={<NotFound/>}/></Route></Routes>
}
export default function App(){return <MockProvider><BrowserRouter><Gate/></BrowserRouter></MockProvider>}
