import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import NotFound from './components/NotFound'
import PostDetail from './pages/PostDetail'
import GroupDetail from './pages/GroupDetail'
import UserDetail from './pages/UserDetail'
import Discover from './pages/Discover'
import Groups from './pages/Groups'
import Create from './pages/Create'
import Messages from './pages/Messages'
import Me from './pages/Me'
import Welcome from './pages/Welcome'
import ProfileSetup from './pages/ProfileSetup'
import Events from './pages/Events'
import EventPage from './pages/EventPage'
import Notifications from './pages/Notifications'
import SuggestEvent from './pages/SuggestEvent'
import Privacy from './pages/Privacy'
import AppProvider from './state/AppProvider'
import { useApp } from './state/AppContext'
import './App.css'
// The privacy page is open to everyone. Otherwise: logged out → Welcome, new account → profile setup, else the app.
function Gate() {
  const { me } = useApp()
  const { pathname } = useLocation()
  if (me === undefined) return null // checking the session; avoids flashing the login screen
  if (pathname === '/privacy' || !me || !me.interests.length)
    return (
      <div className="app-shell">
        <main id="main-content">
          {pathname === '/privacy' ? <Privacy /> : me ? <ProfileSetup first /> : <Welcome />}
        </main>
      </div>
    )
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Discover />} />
        <Route path="groups" element={<Groups />} />
        <Route path="create" element={<Create />} />
        <Route path="messages" element={<Messages />} />
        <Route path="me" element={<Me />} />
        <Route path="me/edit" element={<ProfileSetup />} />
        <Route path="posts/:id" element={<PostDetail />} />
        <Route path="groups/:id" element={<GroupDetail />} />
        <Route path="users/:id" element={<UserDetail />} />
        <Route path="events" element={<Events />} />
        <Route path="events/suggest" element={<SuggestEvent />} />
        <Route path="events/:id" element={<EventPage />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Gate />
      </BrowserRouter>
    </AppProvider>
  )
}
