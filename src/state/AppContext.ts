import { createContext, useContext } from 'react'
import type { Group, Me, NewGroup, ProfileInput, Status } from '../types'

// App-wide state every screen shares: who's logged in, the groups, your memberships and badges.
// Screen-specific data (chat, activities, to-dos, profiles) is loaded by that screen with useApi().
export type AppState = {
  me: Me | null | undefined // undefined = still checking, null = logged out
  signIn: (user: Me) => void
  logout: () => Promise<void>
  saveProfile: (profile: ProfileInput) => Promise<void>
  groups: Group[]
  membership: Record<string, Status>
  refresh: () => Promise<void>
  join: (id: string, intro: string) => Promise<void>
  create: (group: NewGroup) => Promise<string>
  saved: string[]
  save: (id: string) => void
  unread: { total: number; messages: number }
  refreshUnread: () => void
}
export const AppContext = createContext<AppState | null>(null)
export function useApp() {
  const value = useContext(AppContext)
  if (!value) throw new Error('useApp() must be used inside <AppProvider>')
  return value
}
